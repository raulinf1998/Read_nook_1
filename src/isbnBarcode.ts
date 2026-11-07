/** Los códigos EAN de libros son ISBN-13 Bookland (978/979), con dígito válido. */
export function isBookBarcode(value: string): boolean {
  if (!/^97[89]\d{10}$/.test(value)) return false;
  const sum = [...value].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return sum % 10 === 0;
}
