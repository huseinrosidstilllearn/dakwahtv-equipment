export const CATEGORY_ORDER = [
  "Camera Body & Camcorder",
  "Lens",
  "Flash & Lighting",
  "Support Equipment",
  "Video Production",
  "Audio",
  "Battery & Charger",
  "Storage",
  "Streaming & Network",
  "Communication",
  "Editing Room",
  "Perkabelan"
];

export const sortCategories = (cats) => {
  return cats.sort((a, b) => {
    // Case-insensitive exact match
    const idxA = CATEGORY_ORDER.findIndex(c => c.toLowerCase() === a.toLowerCase());
    const idxB = CATEGORY_ORDER.findIndex(c => c.toLowerCase() === b.toLowerCase());
    
    // If both are found in the predefined order array, sort by their index
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    // If a is not found, put it at the end
    if (idxA === -1 && idxB !== -1) return 1;
    // If b is not found, put it at the end
    if (idxA !== -1 && idxB === -1) return -1;
    
    // If neither are found, sort alphabetically
    return a.localeCompare(b);
  });
};
