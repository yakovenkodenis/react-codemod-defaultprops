/**
 * @param {object} fileInfo 
 * @param {import('jscodeshift').API} api 
 */
module.exports = function(fileInfo, api) {
  const { j } = api;
  const root = j(fileInfo.source);

  const propsMap = {};

  return root.find(j.AssignmentExpression).filter((path) => {
    const memberAssignment = path.value.left.type === 'MemberExpression' && path.value.right.type === 'ObjectExpression';
    const isDefaultProps = path.value.left.property?.loc?.identifierName === 'defaultProps';
    return memberAssignment && isDefaultProps;
  }).forEach((path) => {
      path.value.right.properties.forEach((property) => {
        if (property.kind === 'init') {

          const { value, key } = property;

          if (value.type === 'Literal') {
            propsMap[key.name] = {
              value: value.value,
              raw: value.raw,
              type: value.type,
            };
          } else if (value.type === 'JSXElement') {
            const { openingElement, closingElement, children } = value;
            propsMap[key.name] = {
              type: value.type,
              openingElement,
              closingElement,
              children,
            };
          }
        }
      });

    j(path).remove();

    root.find(j.VariableDeclaration, {
      declarations: [{ init: { name: 'props' }, id: { type: 'ObjectPattern' } }],
      kind: 'const',
    })
    .forEach((path) => {
      j(path).replaceWith((nodePath) => {
        const { node } = nodePath;

        node.declarations[0].id.properties.forEach((propertyNode, i) => {
          if (propertyNode.key?.name in propsMap) {
            const value = propsMap[propertyNode.key.name];
            const rightAssignment = getRightAssignment(value);

            node.declarations[0].id.properties[i].value = j.assignmentPattern(
              j.identifier(propertyNode.key.name),
              rightAssignment,
            );

            delete propsMap[propertyNode.key.name];
          }
        });

        Object.entries(propsMap).forEach(([propName, propValue]) => {
          const rightAssignment = getRightAssignment(propValue);
          const leftAssignment = j.memberExpression(j.identifier('props'), j.identifier(propName));

          const propAssignment = j.assignmentExpression('??=', leftAssignment, rightAssignment);
          const statement = j.expressionStatement(propAssignment);

          j(path).insertBefore(statement);
        });

        return node;
      });
    });
  }).toSource();
}

function getRightAssignment(value) {
  if (value.type === 'Literal') {
    return j.literal(value.value);
  } else if (value.type === 'JSXElement') {
    return j.jsxElement(value.openingElement, value.closingElement, value.children);
  }
}
