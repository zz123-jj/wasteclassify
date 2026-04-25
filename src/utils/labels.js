export const WASTE_CLASSES = [
  'cardboard',
  'e-waste',
  'glass',
  'medical_waste',
  'metal',
  'organic_waste',
  'paper',
  'plastic',
];

export const WASTE_SUGGESTIONS = {
  cardboard: 'Recyclable waste',
  'e-waste': 'E-waste recycling point',
  glass: 'Recyclable waste',
  medical_waste: 'Medical or hazardous waste collection',
  metal: 'Recyclable waste',
  organic_waste: 'Food waste bin',
  paper: 'Recyclable waste',
  plastic: 'Recyclable waste',
  other: 'General waste',
};

export const CLASS_COLORS = [
  '#16a34a',
  '#2563eb',
  '#d97706',
  '#0891b2',
  '#7c3aed',
  '#dc2626',
  '#4b5563',
];

export const GUIDE_ITEMS = WASTE_CLASSES.map((className, index) => ({
  className,
  label: formatClassLabel(className),
  color: CLASS_COLORS[index],
  suggestion: WASTE_SUGGESTIONS[className],
}));

export function getWasteSuggestion(className) {
  return WASTE_SUGGESTIONS[className] || WASTE_SUGGESTIONS.other;
}

export function formatClassLabel(className) {
  return className
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
