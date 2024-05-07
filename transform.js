/**
 * @param {object} fileInfo 
 * @param {import('jscodeshift').API} api 
 * @param {object} options
 */
module.exports = function(fileInfo, api, options) 
{
  const { j } = api;
  const root = j(fileInfo.source);

  const printOptions = options.printOptions ?? { quote: 'single' };

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
      if (value.name === 'undefined') return undefined;
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

  /**
   * @type {WeakMap<import('jscodeshift').ASTPath, Record<string, any>>}
   */
  const propsMap = new WeakMap();

  const componentNodeTypes = [
    j.FunctionDeclaration,
    j.ArrowFunctionExpression,
  ];

  for (const componentNodeType of componentNodeTypes) {
    root.find(componentNodeType).forEach((componentNodeTypePath) => {
      let componentName = componentNodeTypePath.value?.id?.name ?? componentNodeTypePath?.parent?.value?.id?.name;

      const isForwardRef = componentNodeTypePath.parent?.value.type === 'CallExpression' && componentNodeTypePath.parent?.value?.callee?.name === 'forwardRef';
      if (isForwardRef) {
        componentName = componentNodeTypePath.parent?.parent?.value?.id?.name;
      }

      if (!componentName) return;

      const firstLetterUppercase = /^[A-Z]/. test(componentName);
      if (!firstLetterUppercase) return; // Not a component.
  
      root.find(j.AssignmentExpression).filter((path) => {
        const isCurrentComponent = path.value.left?.object?.name === componentName;
        const memberAssignment = path.value.left.type === 'MemberExpression' && path.value.right.type === 'ObjectExpression';
        const isDefaultProps = path.value.left.property?.loc?.identifierName === 'defaultProps' || path.value.left.property?.name === 'defaultProps';
        return isCurrentComponent && memberAssignment && isDefaultProps;
      }).forEach((path) => {
          propsMap.set(path, {});
          path.value.right.properties.forEach((property) => {
            if (property.kind === 'init') {
              const { value, key } = property;
              if (key?.name) {
                const prop = { [key.name]: value };
                propsMap.set(path, { ...propsMap.get(path), ...prop });
              }
            }
          });
    
          j(path).remove();
    
          j(componentNodeTypePath).find(j.VariableDeclaration, {
            declarations: [{ init: { name: 'props' }, id: { type: 'ObjectPattern' } }],
            kind: 'const',
          })
          .forEach((propsConstPath) => {
            j(propsConstPath).replaceWith((nodePath) => {
              const { node } = nodePath;
    
              let restElement;
    
              node.declarations[0].id.properties.forEach((propertyNode, i) => {
                if (propertyNode.type === 'RestElement') {
                  restElement = propertyNode;
                } else if (propertyNode.key?.name && propertyNode.key?.name in propsMap.get(path)) {
                  const value = propsMap.get(path)[propertyNode.key.name];
                  const rightAssignment = getRightAssignment(value);
    
                  if (rightAssignment) {
                    node.declarations[0].id.properties[i].value = j.assignmentPattern(
                      j.identifier(propertyNode.value?.name ?? propertyNode.key?.name),
                      rightAssignment,
                    );
      
                    const oldProps = propsMap.get(path);
                    delete oldProps[propertyNode.key.name];
                    propsMap.set(path, oldProps);
                  }
                }
              });
    
              Object.entries(propsMap.get(path)).forEach(([propName, propValue]) => {
                const rightAssignment = getRightAssignment(propValue);
    
                if (restElement && rightAssignment) {
                  const restName = restElement.argument.name;
    
                  const leftAssignment = j.memberExpression(j.identifier(restName), j.identifier(propName));
    
                  const propAssignment = j.assignmentExpression('??=', leftAssignment, rightAssignment);
                  const statement = j.expressionStatement(propAssignment);
    
                  j(propsConstPath).insertAfter(statement);
                }
              });
    
              return node;
            });
          });
      })
  
    })
  }

  return root.toSource(printOptions);
}
