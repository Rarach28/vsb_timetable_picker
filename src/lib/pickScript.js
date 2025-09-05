export async function copyPickScript(selectedEntries, allEntries, timetableData) {
  const script = "dodělej si to sám ťulo :)";

  try {
    await navigator.clipboard.writeText(script);
    return true;
  } catch (err) {
    console.error('Chyba při kopírování:', err);
    // Fallback pro starší prohlížeče
    const textArea = document.createElement('textarea');
    textArea.value = script;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  }
}