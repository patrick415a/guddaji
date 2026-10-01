import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 배포 제외용 대용량 원본은 변경 감시하지 않아 Windows 파일 잠금 오류를 막습니다.
    watch: { ignored: ['**/artifacts/**'] },
  },
})
