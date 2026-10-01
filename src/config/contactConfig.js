export const CONTACT_DETAILS = { email: 'patrick415@gmail.com' };

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const WEB3FORMS_ACCESS_KEY = String(import.meta.env.VITE_WEB3FORMS_ACCESS_KEY ?? '').trim();

export async function sendLetter(letter) {
  if (!WEB3FORMS_ACCESS_KEY) {
    throw new Error('메일 전송 설정이 필요해요. 관리자에게 알려주세요.');
  }

  const name = letter.name.trim();
  const email = letter.email.trim();
  const message = letter.message.trim();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `[구따지] ${name.replace(/[\r\n]/g, ' ')}님의 편지`,
        from_name: '구따지 우편함',
        name,
        email,
        message,
        botcheck: false,
      }),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      if (response.status === 429) {
        throw new Error('편지를 너무 자주 보냈어요. 잠시 뒤 다시 시도해주세요.');
      }
      throw new Error('편지를 보내지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('전송 시간이 오래 걸리고 있어요. 네트워크를 확인하고 다시 시도해주세요.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
