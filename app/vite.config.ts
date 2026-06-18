import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  // 프로덕션 빌드는 neomakes.com/projects/firecall 서브경로에 호스팅된다.
  // dev 서버는 루트(/)로 두고, build 산출물만 서브경로 base를 갖도록 분기.
  base: command === "build" ? "/projects/firecall/" : "/",
  plugins: [react()],
  server: { port: 5180 },
}));
