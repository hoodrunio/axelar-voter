export function addSpaces(str, length) {
    const spaces = length - str.length;
    if (spaces <= 0) {
        return ' ' + str.substring(0, length - 2) + ' ';
    }
    const halfSpaces = Math.floor(spaces / 2);
    const halfSpaces2 = spaces - halfSpaces;

    return ' '.repeat(halfSpaces) + str + ' '.repeat(halfSpaces2);
}