# LeeTKOB — Online Judge & Constraint Review System

**CSC13114 — Advanced Web Application Development (Phát triển ứng dụng Web nâng cao)**  
**Milestone:** PA#3 — Prototype with the LLM feature running  
**Repository:** [https://github.com/USThienPhu/LeeTKOB---WebNC](https://github.com/USThienPhu/LeeTKOB---WebNC) (Tag: `pa3`)

---

## 1. Thông tin nhóm

| MSSV | Họ và tên | Vai trò phân công | Phân hệ chính |
| :---: | :--- | :--- | :--- |
| **23120319** | **Trương Thành Phát** | Thành viên 2 | **AI, Hard Rules, LLM & Constraint Engine** (Tiêu chí 3, 4, 5, 6, 7) |
| **23120327** | **Thái Thiên Phú** | Thành viên 1 | **Infrastructure, Queue & Sandbox Runner** (Tiêu chí 2, 7) |
| **23120380** | **Huỳnh Lê Minh Triết** | Thành viên 3 | **Web Flow, TA Review Queue & Deployment** (Tiêu chí 1, 5, 8) |

---

## 2. Mô hình AI & Bảng tính chi phí cho bài Lab 80 sinh viên (Tiêu chí 4)

### 2.1. Cấu hình mô hình
* **Nhà cung cấp (Provider):** Google Generative AI (Gemini REST API native fetch)
* **Tên mô hình (Model Name):** `gemini-1.5-flash`
* **Đơn giá niêm yết (Pricing):**
  * **Input (Prompt tokens):** \$0.075 / 1,000,000 tokens
  * **Output (Completion tokens):** \$0.300 / 1,000,000 tokens
* **Hạn mức an toàn (Safety Spending Cap):** \$5.00 USD (cấu hình qua biến môi trường `MODEL_SPENDING_CAP_USD=5.00`)

### 2.2. Phép tính số học chi tiết (Cost Arithmetic) cho bài lab 80 sinh viên
Trong một bài lab C++ chuẩn gồm 80 sinh viên với mỗi bài nộp có 2 ràng buộc (1 ban-list và 1 ràng buộc ngữ nghĩa):
1. **Ràng buộc Ban-list (ví dụ: `Do not use std::sort`):**
   * Được xử lý 100% bằng bộ phân tích cú pháp AST-lite (**Hard Rules Parser**).
   * **Số lượt gọi LLM:** 0 lượt gọi.
   * **Chi phí:** **\$0.00 USD**.
2. **Ràng buộc Ngữ nghĩa (Semantic Constraint — ví dụ: `Must implement Merge Sort recursively`):**
   * Số bài nộp cần đánh giá: 80 bài (chỉ đánh giá bài nộp cuối cùng đạt trạng thái `ACCEPTED`).
   * **Số lượt gọi mô hình:** 80 lượt gọi.
   * **Ước lượng Token trung bình mỗi bài nộp** (mã nguồn đã được khử toàn bộ comment, chuỗi thừa và định danh sinh viên):
     * Prompt tokens: ~300 tokens / request (bao gồm mô tả đề bài, ràng buộc và mã nguồn C++ sạch).
     * Completion tokens: ~100 tokens / response (JSON schema `{ "verdict": "pass" | "violation" | "unsure", "evidence": [...] }`).
   * **Tổng lượng token tiêu thụ:**
     $$\text{Prompt Tokens} = 80 \times 300 = 24,000 \text{ tokens}$$
     $$\text{Completion Tokens} = 80 \times 100 = 8,000 \text{ tokens}$$
   * **Tính toán chi phí:**
     $$\text{Prompt Cost} = \frac{24,000}{1,000,000} \times \$0.075 = \$0.00180 \text{ USD}$$
     $$\text{Completion Cost} = \frac{8,000}{1,000,000} \times \$0.300 = \$0.00240 \text{ USD}$$
     $$\textbf{Tổng chi phí cho toàn bài lab 80 sinh viên} = \$0.00180 + \$0.00240 = \mathbf{\$0.00420 \text{ USD}} \approx 105 \text{ VNĐ}$$
   * *(Nếu bài lab có tối đa 2 ràng buộc ngữ nghĩa cần gọi AI $\rightarrow 160$ requests $\rightarrow$ Tổng chi phí là **\$0.00840 USD** $\approx$ 210 VNĐ).*
3. **Thực tế trên gói Google AI Studio Free Tier:**
   * Hạn mức miễn phí: 15 RPM (yêu cầu/phút) và 1,500 RPD (yêu cầu/ngày).
   * Toàn bộ 80 bài nộp được xử lý hoàn toàn miễn phí: **\$0.00 USD**.

---

## 3. Hướng dẫn chạy Standalone Checker CLI & Docker (Tiêu chí 6)

Công cụ Checker CLI độc lập (`src/checker/cli.ts`) và `docker/Dockerfile.checker` cho phép Giảng viên và TA chạy đánh giá tự động các bộ dữ liệu bài nộp (dev set, held-out set) mà không phụ thuộc vào Web Server.

### 3.1. Chạy bằng Docker độc lập (Chế độ chấm thi của Giảng viên)
Đóng gói và chạy container trong môi trường bị ngắt hoàn toàn kết nối Internet (`--network none`) và cờ `MODEL_OFF=1`:

```bash
# 1. Build image Docker cho Checker
docker build -t leetkob-checker -f docker/Dockerfile.checker .

# 2. Chạy chấm bộ test offline (không có mạng, hard rules chạy, semantic -> unsure, 0 wrongful deductions)
docker run --network none -e MODEL_OFF=1 -v $(pwd)/custom-cases:/data leetkob-checker --dataset /data --out /data/predictions.jsonl
```

### 3.2. Chạy trực tiếp qua npm / Node.js
```bash
# Chạy với MODEL_OFF=1 (Hard rules bắt vi phạm, semantic gán unsure, không gọi mạng)
MODEL_OFF=1 npm run checker -- --dataset custom-cases --out predictions.jsonl

# Chạy với mô hình AI thật (yêu cầu MODEL_API_KEY trong .env)
npm run checker -- --dataset custom-cases --out predictions.jsonl
```

### 3.3. Định dạng đầu ra `predictions.jsonl`
Mỗi dòng là một bản ghi JSON chuẩn (`PredictionRecord`):
```json
{"solution":"custom-cases/s02","constraint":"C1","verdict":"violation","evidence":[{"line":8,"text":"    std::sort(arr.begin(), arr.end());"}]}
```

---

## 4. Kiểm thử & Cổng chất lượng (Quality Gate)

Dự án tuân thủ nghiêm ngặt quy trình TDD và cổng chất lượng CI chặn merge khi có lỗi:

```bash
# Chạy toàn bộ cổng chất lượng (Format check, Lint, Typecheck, Test)
npm run check

# Chạy riêng bộ test Vitest
npm test

# Chạy riêng các bài kiểm thử phân hệ Constraint Checker & Hard Rules
npx vitest run tests/checker/
```

