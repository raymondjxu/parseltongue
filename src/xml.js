function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderSegments(segments) {
  return segments
    .map((segment) => {
      if (segment.highlighted) {
        return `<highlight>${escapeXml(segment.text)}</highlight>`;
      }
      return escapeXml(segment.text);
    })
    .join('');
}

function indentLine(level, line) {
  return `${'  '.repeat(level)}${line}`;
}

function serializeCard(node, level) {
  const lines = [];
  const attrs = [];
  if (node.missingCite) {
    attrs.push('missingCite="true"');
  }
  if (node.red) {
    attrs.push('red="true"');
  }
  const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';
  lines.push(indentLine(level, `<card${attrText}>`));
  lines.push(indentLine(level + 1, `<tag>${escapeXml(node.tag)}</tag>`));
  lines.push(indentLine(level + 1, `<cite>${escapeXml(node.cite || '')}</cite>`));
  lines.push(
    indentLine(level + 1, `<cardText>${renderSegments(node.cardTextSegments)}</cardText>`)
  );
  lines.push(indentLine(level, '</card>'));
  return lines;
}

function serializeContainer(node, level) {
  const lines = [];
  lines.push(indentLine(level, `<${node.type}>`));
  lines.push(indentLine(level + 1, `<title>${escapeXml(node.title)}</title>`));
  for (const child of node.children) {
    lines.push(...serializeNode(child, level + 1));
  }
  lines.push(indentLine(level, `</${node.type}>`));
  return lines;
}

function serializeNode(node, level) {
  if (node.type === 'card') {
    return serializeCard(node, level);
  }
  if (node.type === 'pocket' || node.type === 'hat' || node.type === 'block') {
    return serializeContainer(node, level);
  }
  if (node.type === 'file') {
    const lines = [indentLine(level, '<file>')];
    for (const child of node.children) {
      lines.push(...serializeNode(child, level + 1));
    }
    lines.push(indentLine(level, '</file>'));
    return lines;
  }
  return [];
}

function toXml(fileNode) {
  return serializeNode(fileNode, 0).join('\n');
}

module.exports = {
  toXml,
};
