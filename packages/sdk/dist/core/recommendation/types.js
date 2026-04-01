// Helper function to normalize response (check 'item' first, fallback to 'items')
export function normalizeItems(response) {
    if (!response)
        return [];
    // Priority: item > items > empty array
    if (response.item && response.item.length > 0)
        return response.item;
    if (response.items && response.items.length > 0)
        return response.items;
    return [];
}
//# sourceMappingURL=types.js.map