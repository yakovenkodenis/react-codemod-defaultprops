### react-codemod-default-props

This is a JSCodeshift React codemod that helps update React defaultProps API to props destructuring with default values to facilitate the upgrade to React 19.


### Usage

```sh
npx react-codemod-default-props
```

This will start an interactive wizard, and then run the transform.


##### Before:
```javascript
function IconButton(props) {
  const {
    className,
    disabled,
    icon,
    label,
    link,
    onLinkClick,
    stopPropagation,
    withIcon,
    ...rest,
  } = props;

  return <Button>...</Button>;
}

IconButton.defaultProps = {
  disabled: false,
  icon: <Icon />,
  label: '',
  stopPropagation: false,
  withIcon: true,
  id: '',
  name: '',
};

export default memo(IconButton);
```

##### After:
```javascript
function IconButton(props) {
  const {
    className,
    disabled = false,
    icon = <Icon />,
    label = '',
    link,
    onLinkClick,
    stopPropagation = false,
    withIcon = true,
  } = props;

  rest.id ??= '';
  rest.name ??= '';

  return <Button>...</Button>;
}

export default memo(IconButton);
```

### Warning
Beware of the reference type props. E.g., you have an object or a function as a default prop defined in `Component.defaultProps`, refactoring it to props destructuring might cause an infinite loop since the component will receive a new reference to the object on every render.
