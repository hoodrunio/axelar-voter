export function exportVoterAddress(content) {
    return content.split(' ')[0].replace('$', '');
}