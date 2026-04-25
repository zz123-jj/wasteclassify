import { CLASS_COLORS, WASTE_CLASSES, formatClassLabel } from './labels.js';

const NMS_IOU_THRESHOLD = 0.45;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getOutputTensorData(outputTensor) {
  if (!outputTensor?.data || !outputTensor?.dims) {
    throw new Error('YOLO output tensor is missing data or dimensions.');
  }

  return {
    data: outputTensor.data,
    dims: outputTensor.dims,
  };
}

function readRows(outputTensor) {
  const { data, dims } = getOutputTensorData(outputTensor);

  // Ultralytics YOLO ONNX exports are commonly [1, attributes, boxes].
  if (dims.length === 3) {
    const [, dimA, dimB] = dims;
    const attributesFirst = dimA < dimB;
    const rowCount = attributesFirst ? dimB : dimA;
    const attributeCount = attributesFirst ? dimA : dimB;

    return Array.from({ length: rowCount }, (_, rowIndex) => {
      const row = new Array(attributeCount);

      for (let attrIndex = 0; attrIndex < attributeCount; attrIndex += 1) {
        row[attrIndex] = attributesFirst
          ? data[attrIndex * rowCount + rowIndex]
          : data[rowIndex * attributeCount + attrIndex];
      }

      return row;
    });
  }

  if (dims.length === 2) {
    const [dimA, dimB] = dims;
    const attributesFirst = dimA < dimB;
    const rowCount = attributesFirst ? dimB : dimA;
    const attributeCount = attributesFirst ? dimA : dimB;

    return Array.from({ length: rowCount }, (_, rowIndex) => {
      const row = new Array(attributeCount);

      for (let attrIndex = 0; attrIndex < attributeCount; attrIndex += 1) {
        row[attrIndex] = attributesFirst
          ? data[attrIndex * rowCount + rowIndex]
          : data[rowIndex * attributeCount + attrIndex];
      }

      return row;
    });
  }

  throw new Error(`Unsupported YOLO output shape: [${dims.join(', ')}]`);
}

function getBestClass(row) {
  if (isEndToEndDetectionRow(row)) {
    return {
      classIndex: Math.round(row[5]),
      confidence: row[4],
    };
  }

  const noObjectnessClassStart = 4;
  const objectnessClassStart = 5;
  const hasObjectness = row.length >= objectnessClassStart + WASTE_CLASSES.length;
  const classStart = hasObjectness ? objectnessClassStart : noObjectnessClassStart;
  const objectness = hasObjectness ? row[4] : 1;
  let bestClassIndex = 0;
  let bestClassScore = 0;

  for (let index = 0; index < WASTE_CLASSES.length; index += 1) {
    const score = row[classStart + index] ?? 0;

    if (score > bestClassScore) {
      bestClassScore = score;
      bestClassIndex = index;
    }
  }

  return {
    classIndex: bestClassIndex,
    confidence: objectness * bestClassScore,
  };
}

function isEndToEndDetectionRow(row) {
  if (row.length !== 6) {
    return false;
  }

  const [x1, y1, x2, y2, score, classId] = row;
  const hasValidScore = score >= 0 && score <= 1;
  const hasValidClassId = classId >= 0 && classId < WASTE_CLASSES.length + 1;
  const looksLikeXyxy = x2 >= x1 && y2 >= y1;

  return hasValidScore && hasValidClassId && looksLikeXyxy;
}

function maybeScaleNormalizedBox(box, metadata) {
  const maxValue = Math.max(box.x1, box.y1, box.x2, box.y2);

  if (maxValue > 2) {
    return box;
  }

  return {
    x1: box.x1 * metadata.inputSize,
    y1: box.y1 * metadata.inputSize,
    x2: box.x2 * metadata.inputSize,
    y2: box.y2 * metadata.inputSize,
  };
}

function paddedXyxyToVideoBox(box, metadata) {
  const scaledBox = maybeScaleNormalizedBox(box, metadata);
  const sourceX1 = (scaledBox.x1 - metadata.padX) / metadata.scale;
  const sourceY1 = (scaledBox.y1 - metadata.padY) / metadata.scale;
  const sourceX2 = (scaledBox.x2 - metadata.padX) / metadata.scale;
  const sourceY2 = (scaledBox.y2 - metadata.padY) / metadata.scale;
  const x1 = clamp(sourceX1, 0, metadata.sourceWidth);
  const y1 = clamp(sourceY1, 0, metadata.sourceHeight);
  const x2 = clamp(sourceX2, 0, metadata.sourceWidth);
  const y2 = clamp(sourceY2, 0, metadata.sourceHeight);

  return {
    x: x1,
    y: y1,
    width: Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1),
  };
}

function centerXywhToVideoBox(row, metadata) {
  let [centerX, centerY, width, height] = row;

  // Some exports emit normalized box values. Convert those back to pixels.
  if (Math.max(centerX, centerY, width, height) <= 2) {
    centerX *= metadata.inputSize;
    centerY *= metadata.inputSize;
    width *= metadata.inputSize;
    height *= metadata.inputSize;
  }

  return paddedXyxyToVideoBox(
    {
      x1: centerX - width / 2,
      y1: centerY - height / 2,
      x2: centerX + width / 2,
      y2: centerY + height / 2,
    },
    metadata,
  );
}

function detectionRowToVideoBox(row, metadata) {
  if (isEndToEndDetectionRow(row)) {
    return paddedXyxyToVideoBox(
      {
        x1: row[0],
        y1: row[1],
        x2: row[2],
        y2: row[3],
      },
      metadata,
    );
  }

  return centerXywhToVideoBox(row, metadata);
}

function getIntersectionOverUnion(boxA, boxB) {
  const ax2 = boxA.x + boxA.width;
  const ay2 = boxA.y + boxA.height;
  const bx2 = boxB.x + boxB.width;
  const by2 = boxB.y + boxB.height;
  const intersectionX = Math.max(0, Math.min(ax2, bx2) - Math.max(boxA.x, boxB.x));
  const intersectionY = Math.max(0, Math.min(ay2, by2) - Math.max(boxA.y, boxB.y));
  const intersection = intersectionX * intersectionY;
  const areaA = boxA.width * boxA.height;
  const areaB = boxB.width * boxB.height;
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}

function applyNonMaximumSuppression(detections) {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const selected = [];

  sorted.forEach((candidate) => {
    const overlapsSelected = selected.some((kept) => {
      const sameClass = kept.classIndex === candidate.classIndex;
      return sameClass && getIntersectionOverUnion(kept.box, candidate.box) > NMS_IOU_THRESHOLD;
    });

    if (!overlapsSelected) {
      selected.push(candidate);
    }
  });

  return selected;
}

export function postprocessYoloOutput(outputTensor, options) {
  const { confidenceThreshold, metadata } = options;
  const rows = readRows(outputTensor);
  const detections = [];

  rows.forEach((row, index) => {
    const { classIndex, confidence } = getBestClass(row);

    if (confidence < confidenceThreshold) {
      return;
    }

    const box = detectionRowToVideoBox(row, metadata);

    if (box.width <= 1 || box.height <= 1) {
      return;
    }

    const className = WASTE_CLASSES[classIndex] || 'other';

    detections.push({
      id: `${index}-${classIndex}-${Math.round(confidence * 1000)}`,
      box,
      classIndex,
      className,
      label: formatClassLabel(className),
      confidence,
      color: CLASS_COLORS[classIndex] || CLASS_COLORS[CLASS_COLORS.length - 1],
    });
  });

  return applyNonMaximumSuppression(detections).slice(0, 20);
}
