export function getCookie(name){
  return (document.cookie.split('; ')
          .find(c => c.startsWith(name + '=')) || '')
          .split('=')[1] || '';
}

export function saveBlob(blob, filename){
  const a = document.createElement('a');
  a.href  = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
