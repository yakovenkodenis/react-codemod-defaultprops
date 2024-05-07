/**
 * @param {object} fileInfo 
 * @param {import('jscodeshift').API} api 
 */
module.exports = function(fileInfo, api) {
  const { j } = api;
  const root = j(fileInfo.source);

  function getRightAssignment(value) {
    if (value.type === 'Literal') {
      return j.literal(value.value);
    } else if (value.type === 'JSXElement') {
      return j.jsxElement(value.openingElement, value.closingElement, value.children);
    } else if (value.type === 'MemberExpression') {
      return j.memberExpression(j.identifier(value.object.name), value.property);
    } else if (value.type === 'ArrowFunctionExpression') {
      return j.arrowFunctionExpression(value.params, value.body);
    } else if (value.type === 'FunctionExpression') {
      return j.functionExpression(j.identifier(value.id.name), value.params, value.body);
    } else if (value.type === 'NewExpression') {
      return j.newExpression(j.identifier(value.callee.name), value.arguments);
    } else if (value.type === 'ObjectExpression') {
      return j.objectExpression(value.properties)
    } else if (value.type === 'ArrayExpression') {
      return j.arrayExpression(value.elements);
    } else if (value.type === 'Identifier') {
      return j.identifier(value.name);
    } else if (value.type === 'CallExpression') {
      return j.callExpression(value.callee, value.arguments);
    } else if (value.type === 'ConditionalExpression') {
      return j.conditionalExpression(value.test, value.consequent, value.alternate);
    } else if (value.type === 'BinaryExpression') {
      return j.binaryExpression(value.operator, value.left, value.right);
    } else if (value.type === 'UnaryExpression') {
      return j.unaryExpression(value.operator, value.argument, value.prefix);
    } else {
      throw new Error(`Unsupported value type: ${value}`);
    }
  }  

  const propsMap = {};

  return root.find(j.AssignmentExpression).filter((path) => {
    const memberAssignment = path.value.left.type === 'MemberExpression' && path.value.right.type === 'ObjectExpression';
    const isDefaultProps = path.value.left.property?.loc?.identifierName === 'defaultProps';
    return memberAssignment && isDefaultProps;
  }).forEach((path) => {
      path.value.right.properties.forEach((property) => {
        if (property.kind === 'init') {
          const { value, key } = property;
          if (key?.name) propsMap[key.name] = value;
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
          if (propertyNode.key?.name && propertyNode.key?.name in propsMap) {
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

          if (rightAssignment) {
            const leftAssignment = j.memberExpression(j.identifier('props'), j.identifier(propName));

            const propAssignment = j.assignmentExpression('??=', leftAssignment, rightAssignment);
            const statement = j.expressionStatement(propAssignment);

            j(path).insertBefore(statement);
          }
        });

        return node;
      });
    });
  }).toSource();
}
