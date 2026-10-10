export function csvCell(value:unknown){const text=String(value??'');const safe=/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text)?`'${text}`:text;return `"${safe.replace(/"/g,'""')}"`;}
export function csv(rows:unknown[][]){return '\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');}
