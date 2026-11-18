// Preserve table semantics while making wide Markdown tables reachable
// and horizontally scrollable with a keyboard, including in WebKit.
export default function scrollableTables() {
  let tableNumber = 0;
  function wrap(node) {
    if (!node.children) return;
    node.children = node.children.map((child) => {
      if (child.type !== 'element' || child.tagName !== 'table') {
        wrap(child);
        return child;
      }
      return {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['doc-table-scroll'],
          tabIndex: 0,
          role: 'region',
          ariaLabel: `Reference table ${++tableNumber}`
        },
        children: [child]
      };
    });
  }
  return (root) => {
    tableNumber = 0;
    wrap(root);
  };
}
