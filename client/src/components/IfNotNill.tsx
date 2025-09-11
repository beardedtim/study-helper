/**
 * Only renders children if the value is not null, undefined, empty string, false, or 0.
 * Otherwise, renders nothing.
 */
const IfNotNill = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: any;
}) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === false ||
    value === 0
  ) {
    console.log("OH NO");
    return null;
  }
  return children;
};

export default IfNotNill;
