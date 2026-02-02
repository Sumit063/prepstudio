export const formatDate = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  return value.split("T")[0];
};

export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  const datePart = date.toLocaleDateString();
  const timePart = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
};
