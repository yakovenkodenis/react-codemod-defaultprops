Before:
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

After:
```javascript
function IconButton(props) {
  props.id ??= "";
  props.name ??= "";

  const {
    className,
    disabled = false,
    icon = <Icon />,
    label = "",
    link,
    onLinkClick,
    stopPropagation = false,
    withIcon = true,
  } = props;

  return <Button>...</Button>;
}

export default memo(IconButton);
```


# Run
```sh
jscodeshift -t transform.js ./target-file.js
```
