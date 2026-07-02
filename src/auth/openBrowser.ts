import { spawn } from 'node:child_process';

function getOpenCommand(url: string): { command: string; args: string[] } {
  if (process.platform === 'darwin') {
    return { command: 'open', args: [url] };
  }
  if (process.platform === 'win32') {
    return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] };
  }
  return { command: 'xdg-open', args: [url] };
}

export function openBrowser(url: string): void {
  const { command, args } = getOpenCommand(url);
  const child = spawn(command, args, {
    stdio: 'ignore',
    windowsHide: true,
  });
  let reported = false;

  const reportFallback = (): void => {
    if (reported) return;
    reported = true;
    console.error('[Auth] 브라우저를 자동으로 열 수 없습니다. 직접 열어주세요:');
    console.error(url);
  };

  child.on('error', reportFallback);
  child.on('close', (code) => {
    if (code !== 0) {
      reportFallback();
    }
  });
}
