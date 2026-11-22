# 🎯 KẾ HOẠCH TRIỂN KHAI CHI TIẾT — THÀNH VIÊN 2 (AI, Hard Rules, LLM & Constraint Engine)

> **Người thực hiện:** Trương Thành Phát (Thành viên 2)  
> **Nhánh làm việc:** `feature/constraint-engine` (tách từ `main`)  
> **Hạn chót nộp bài:** 22:00, Thứ Tư, 25/11/2026  
> **Trọng tâm Rubric:**  
> - **Tiêu chí 3:** Hard rules first — 15 điểm  
> - **Tiêu chí 4:** The model judges the semantic constraints — 20 điểm  
> - **Tiêu chí 5:** First limits, guardrails & review queue — 10 điểm  
> - **Tiêu chí 6:** The checker command and a first eval — 10 điểm  
> - **Tiêu chí 7:** Tests first, one part per commit — 5 điểm  
> - **Tiêu chí 8:** AI-LOG.md — 5 điểm  

---

## 1. TỔNG QUAN VỊ TRÍ & ĐIỂM TIẾP NHẬN CỦA THÀNH VIÊN 2

Hệ thống LeeTKOB hiện tại đã có hạ tầng Sandbox (TV1) và Luồng Web API / Review Queue (TV3). Cầu nối giữa hệ thống và phân hệ của bạn nằm tại:

```
src/
├── types/constraint.types.ts       ← Interface contracts chuẩn (ĐÃ CÓ - TUÂN THỦ NGHIÊM NGẶT)
├── engine/constraint-adapter.ts    ← Mock Adapter hiện tại (BẠN SẼ THAY THẾ BẰNG ENGINE THẬT)
├── checker/                        ← Thư mục mới cho phân hệ của TV2
│   ├── hard-rules.ts               ← Bộ kiểm tra cú pháp AST/Lexer (Tiêu chí 3)
│   ├── prompt-sanitizer.ts         ← Xóa comment và ẩn danh định danh sinh viên (Tiêu chí 4)
│   ├── llm-client.ts               ← Gọi Gemini API thật cho semantic constraints (Tiêu chí 4)
│   ├── guardrails.ts               ← Schema Guard, Timeout Guard, Evidence Guard (Tiêu chí 5)
│   ├── call-logger.ts              ← Ghi nhận call_log.jsonl (requestId, cost, tokens) (Tiêu chí 4)
│   └── cli.ts                      ← Checker CLI độc lập hỗ trợ MODEL_OFF=1 (Tiêu chí 6)
docker/
└── Dockerfile.checker              ← Dockerfile chạy độc lập cho Giảng viên test (Tiêu chí 6)
custom-cases/                       ← 5 test cases tự viết có kèm trap & injection (Tiêu chí 6)
```

> [!IMPORTANT]
> **Quy tắc bất di bất dịch của Rubric PA#3:**
> 1. **The Syllabus Rule:** Tuyệt đối không để LLM tự quyết định điểm trừ hoặc tự động publish điểm cho sinh viên mà không qua TA Review Queue.
> 2. **TDD & Commit tách biệt:** Viết test trước (`test(...)`), sau đó mới viết code tính năng (`feat(...)`). Mỗi phần là một commit độc lập. Tuyệt đối không squash commit!
> 3. **Baseline Tests:** Toàn bộ test suite hiện có của nhóm phải luôn luôn xanh (`npm run check`).

---

## PHASE 0: CHUẨN BỊ MÔI TRƯỜNG & KHỞI TẠO NHÁNH

### Mục tiêu
Tạo nhánh làm việc `feature/constraint-engine` từ `main` mới nhất, xác nhận baseline xanh.

### Các lệnh thực hiện:
```bash
git checkout main
git pull origin main
git checkout -b feature/constraint-engine
npm run check
```

---

## PHASE 1: HARD RULES PARSER CÚ PHÁP C++ & ANTI-TRAPS (Tiêu chí 3 — 15 điểm)

### Mục đích
Rà soát vi phạm cú pháp chính xác tuyệt đối mà không cần gọi LLM, xử lý triệt để các bẫy (Traps) từ đề bài:
- Ràng buộc dạng ban-list: `"Do not use `xyz`"` hoặc `"Do not call `xyz`"`.
- Dùng Tokenizer/Lexer bóc tách mã nguồn C++, **loại bỏ chuỗi ký tự (`"..."`, `'...'`) và chú thích (`//`, `/* */`) trước khi phân tích**.
- Không kích hoạt bẫy (Traps):
  1. Tên hàm cấm nằm trong comment hoặc chuỗi in $\rightarrow$ Không phạt.
  2. Hàm trùng tên nằm trong namespace riêng của sinh viên (`my_space::sort()`) $\rightarrow$ Không phạt.
  3. `#include <algorithm>` chỉ dùng `std::swap` $\rightarrow$ Không phạt.
- Khi Hard Rule bắt được vi phạm: gán `verdict: 'violation'`, dòng `evidence` chính xác, và **đánh dấu `decidedBy: 'hard_rule'` (bỏ qua không gọi LLM)**.

### Commit 1a — TEST FIRST (Viết bài kiểm thử trước)
* **File tạo:** `tests/checker/hard-rules.test.ts`
* **Nội dung test cases:**
  1. Phát hiện vi phạm ban-list cơ bản: code gọi `std::sort(a, a+n);` $\rightarrow$ `verdict: 'violation'`, trích đúng dòng vi phạm.
  2. Trap 1: Tên hàm cấm nằm trong comment (`// std::sort here`) hoặc chuỗi (`std::cout << "std::sort";`) $\rightarrow$ `verdict: 'pass'`.
  3. Trap 2: Hàm trùng tên trong namespace riêng (`namespace custom { void sort() {} } custom::sort();`) $\rightarrow$ `verdict: 'pass'`.
  4. Trap 3: Include `<algorithm>` nhưng chỉ gọi `std::swap` $\rightarrow$ `verdict: 'pass'`.
  5. Đánh dấu `decidedBy: 'hard_rule'` và không chuyển tiếp sang LLM.

### Commit 1b — IMPLEMENTATION
* **File tạo:** `src/checker/hard-rules.ts`
* Xây dựng hàm `checkHardRules(sourceCode: string, constraints: ConstraintDefinition[])`.

### Git commits:
```bash
git add tests/checker/hard-rules.test.ts
git commit -m "test(hard-rules): add syntax-aware test cases covering comments, strings and namespace traps"

git add src/checker/hard-rules.ts
git commit -m "feat(hard-rules): implement syntax-aware ast ban-list checker avoiding traps"
```

---

## PHASE 2: PROMPT SANITIZER — XÓA COMMENT & ẨN DANH THÔNG TIN (Tiêu chí 4 — 20 điểm)

### Mục đích
Bảo vệ quyền riêng tư của sinh viên và ngăn chặn thiên kiến khi gửi prompt đến LLM:
- Xóa sạch toàn bộ comments (`//`, `/* ... */`).
- Xóa các thông tin định danh sinh viên: Họ tên, MSSV (ví dụ: `23120xxx`), Email sinh viên.
- Đóng gói dữ liệu prompt chỉ gồm: Đề bài (`statement`), danh sách ràng buộc (`constraints`), và mã nguồn sạch (`sanitizedCode`).

### Commit 2a — TEST FIRST
* **File tạo:** `tests/checker/prompt-sanitizer.test.ts`
* **Nội dung test:**
  1. Kiểm tra xóa toàn bộ comment 1 dòng và nhiều dòng trong code C++.
  2. Kiểm tra lọc bỏ các mẫu định danh sinh viên (MSSV 8 chữ số, tên, email).
  3. Kiểm tra bảo toàn đúng số dòng code hoặc ánh xạ dòng chính xác để không làm lệch dòng dẫn chứng (`evidence`).

### Commit 2b — IMPLEMENTATION
* **File tạo:** `src/checker/prompt-sanitizer.ts`
* Xây dựng hàm `sanitizeSourceCode(sourceCode: string)` và `buildSanitizedPrompt(...)`.

### Git commits:
```bash
git add tests/checker/prompt-sanitizer.test.ts
git commit -m "test(sanitizer): add test cases for stripping comments and student identifiers"

git add src/checker/prompt-sanitizer.ts
git commit -m "feat(sanitizer): implement code sanitizer and prompt builder"
```

---

## PHASE 3: GUARDRAILS & FIRST LIMITS (Tiêu chí 5 — 10 điểm)

### Mục đích
Đảm bảo tính ổn định và an toàn trước các phản hồi bất định từ LLM (theo Tiêu chí 5):
- **Schema Guard:** Nếu model trả về output không parse được JSON, sai format hoặc thiếu trường `verdict` / `evidence` $\rightarrow$ Tự động chuyển thành `verdict: 'unsure'` (`unsureReason: 'schema_mismatch'`).
- **Timeout Guard:** Bọc lời gọi model trong Promise timeout (10–15s). Nếu quá thời gian $\rightarrow$ Tự động ngắt và trả về `verdict: 'unsure'` (`unsureReason: 'timeout'`).
- **Evidence Guard:** Đối soát dòng mã nguồn trong `evidence[].text` với mã nguồn nộp gốc. Nếu nội dung dòng không khớp ký tự $\rightarrow$ Tự động chuyển thành `unsure` (`unsureReason: 'line_mismatch'`).
- **Unit Test Mock Offline:** Các bài kiểm tra phải dùng model giả lập (fake model/mock), **không kết nối mạng**, chứng minh 100% fallback thành `unsure` an toàn.

### Commit 3a — TEST FIRST (Offline Mock Tests)
* **File tạo:** `tests/checker/guardrails.test.ts`
* **Nội dung test:**
  1. Fake model trả về chuỗi JSON rác / sai schema $\rightarrow$ trả về `unsure` (`schema_mismatch`).
  2. Fake model delay 20s (vượt timeout limit) $\rightarrow$ trả về `unsure` (`timeout`).
  3. Evidence line trích dẫn nội dung code không có trong file gốc $\rightarrow$ trả về `unsure` (`line_mismatch`).

### Commit 3b — IMPLEMENTATION
* **File tạo:** `src/checker/guardrails.ts`
* Xây dựng hàm `validateModelOutput(...)`, `withTimeout(...)`, và `verifyEvidenceLines(...)`.

### Git commits:
```bash
git add tests/checker/guardrails.test.ts
git commit -m "test(guardrails): add offline mock tests for schema mismatch, timeout, and evidence verification"

git add src/checker/guardrails.ts
git commit -m "feat(guardrails): implement schema validation, timeout wrapper, and evidence guard"
```

---

## PHASE 4: LLM CLIENT & PROVIDER CALL LOGGER (Tiêu chí 4 — 20 điểm)

### Mục đích
Gọi mô hình AI thật để đánh giá các ràng buộc ngữ nghĩa (Semantic Constraints: Merge sort vs Bubble sort, đệ quy, mảng phụ):
- Tích hợp Gemini API (`@google/genai` hoặc Google Generative AI REST API) với API key lấy từ biến môi trường `GEMINI_API_KEY`.
- Model chỉ trả về `pass`, `violation` hoặc `unsure` kèm `evidence lines`. **Tuyệt đối không để LLM quyết định mức trừ điểm (`deduction`)**.
- **Call Logger (`call_log.jsonl`):** Ghi lại log từng lượt gọi với đầy đủ thông tin:
  - `requestId` thật từ provider (chứng minh không mock khi chấm dev set).
  - `model`, `promptTokens`, `completionTokens`, `latencyMs`, `costUsd`.
- Tính toán chi phí cho 1 bài lab 80 sinh viên để ghi vào `README.md` và `AI-LOG.md`.

### Commit 4a — TEST FIRST
* **File tạo:** `tests/checker/llm-client.test.ts`
* **Nội dung test:**
  1. Mock SDK/HTTP call để kiểm tra logic ánh xạ kết quả từ API thành `ConstraintVerdict`.
  2. Kiểm tra ghi log vào file `call_log.jsonl` có đầy đủ các trường `requestId`, tokens, cost.
  3. Đảm bảo `deduction` luôn được giữ nguyên từ cấu hình của TA, không bị model ghi đè.

### Commit 4b — IMPLEMENTATION
* **File tạo:** `src/checker/llm-client.ts` và `src/checker/call-logger.ts`

### Git commits:
```bash
git add tests/checker/llm-client.test.ts
git commit -m "test(llm): add test cases for llm semantic evaluation and call logging"

git add src/checker/llm-client.ts src/checker/call-logger.ts
git commit -m "feat(llm): implement gemini client with call logger and cost tracking"
```

---

## PHASE 5: THAY THẾ MOCK ADAPTER — TÍCH HỢP ENGINE HOÀN CHỈNH

### Mục đích
Nối toàn bộ các module của TV2 vào luồng chung của hệ thống, thay thế mock tạm thời tại `src/engine/constraint-adapter.ts`:
- Khi bài nộp đạt `ACCEPTED` $\rightarrow$ Engine tiếp nhận:
  1. Chạy Hard Rules trước cho các ràng buộc ban-list.
  2. Nếu phát hiện vi phạm $\rightarrow$ Chốt `violation`, không gọi model.
  3. Đối với các ràng buộc ngữ nghĩa còn lại $\rightarrow$ Chạy qua Sanitizer $\rightarrow$ Gọi LLM với Guardrails bảo vệ.
  4. Trả về mảng `ConstraintVerdict[]` chuẩn để lưu vào Store và đưa lên Review Queue cho TA.

### Commit 5a — TEST FIRST
* **File cập nhật/tạo mới:** `tests/engine/constraint-engine.test.ts`
* **Nội dung test:**
  1. Kiểm tra luồng tích hợp: Ràng buộc ban-list vi phạm thì model không được gọi (xác nhận call logger rỗng).
  2. Kiểm tra luồng tích hợp: Ràng buộc ngữ nghĩa kích hoạt model và ghi nhận kết quả vào verdict.

### Commit 5b — IMPLEMENTATION
* **File cập nhật:** `src/engine/constraint-adapter.ts` (chuyển sang gọi Engine thật).

### Git commits:
```bash
git add tests/engine/constraint-engine.test.ts
git commit -m "test(engine): add integration tests for hard-rules shortcut and llm execution"

git add src/engine/constraint-adapter.ts
git commit -m "feat(engine): connect real hard-rules and llm engine replacing mock adapter"
```

---

## PHASE 6: CHECKER CLI & CHẾ ĐỘ `MODEL_OFF=1` (Tiêu chí 6 — 10 điểm)

### Mục đích
Cung cấp công cụ CLI độc lập cho Giảng viên chạy chấm bộ test dev-set và held-out set:
- Script `src/checker/cli.ts` nhận tham số: `--dataset <path>` và `--out <predictions.jsonl>`.
- Hỗ trợ cờ biến môi trường **`MODEL_OFF=1`**:
  - Khi bật: Chỉ chạy Hard Rules, các ràng buộc ngữ nghĩa tự động gán `unsure`.
  - **Tuyệt đối không mở kết nối mạng**.
  - Kết quả chạy qua `eval.mjs` có exit code 0 hoặc 1 (tuyệt đối không bị lỗi 2).
  - Đạt **0 wrongful deductions** trên các bài hợp lệ (compliant solutions) của bộ dev set.
- Tạo `docker/Dockerfile.checker` độc lập để Giảng viên chạy bằng lệnh:  
  `docker run --network none -e MODEL_OFF=1 ...`

### Commit 6a — TEST FIRST
* **File tạo:** `tests/checker/cli.test.ts`
* **Nội dung test:**
  1. Kiểm tra CLI sinh đúng format JSONL theo từng dòng: `{"solution": "...", "constraint": "...", "verdict": "...", "evidence": [...]}`.
  2. Kiểm tra khi có `MODEL_OFF=1`: Không gọi network, hard rules vẫn bắt đúng, semantic rules ra `unsure`.

### Commit 6b — IMPLEMENTATION
* **File tạo:** `src/checker/cli.ts` và `docker/Dockerfile.checker`

### Git commits:
```bash
git add tests/checker/cli.test.ts
git commit -m "test(checker): add tests for checker cli output format and MODEL_OFF flag"

git add src/checker/cli.ts docker/Dockerfile.checker
git commit -m "feat(checker): implement standalone checker cli and Dockerfile with MODEL_OFF support"
```

---

## PHASE 7: SOẠN BỘ CUSTOM CASES & THỰC NGHIỆM DEV SET (Tiêu chí 4 & 6)

### Mục đích
1. **Tạo tối thiểu 5 Custom Cases** trong thư mục riêng `custom-cases/` theo đúng cấu trúc đề bài:
   - Có ít nhất 1 bài Bẫy (Trap - ví dụ: hàm trùng tên trong comment hoặc namespace riêng).
   - Có ít nhất 1 bài Prompt Injection (ví dụ: comment yêu cầu bỏ qua kiểm tra và luôn pass).
   - Có file `labels.jsonl` đính kèm để đối soát.
2. **Thực nghiệm chạy thật trên bộ Dev Set:**
   - Chạy với API key thật để sinh `predictions.jsonl`, `call_log.jsonl` (có `requestId`), và lưu báo cáo kết quả từ `eval.mjs`.

### Git commit:
```bash
git add custom-cases/ eval-results/
git commit -m "feat(eval): add 5 custom evaluation cases and committed real-model dev-set run"
```

---

## PHASE 8: CẬP NHẬT TÀI LIỆU & HỒ SƠ BÀN GIAO (Tiêu chí 8)

### Mục đích
Hoàn thiện toàn bộ các trường thông tin của TV2 trong hồ sơ nhóm:
1. **`PA3.md`:** Cập nhật mục *Hướng dẫn chạy Docker Checker CLI* (lệnh build Docker và lệnh run với `--network none` và `MODEL_OFF=1`).
2. **`README.md`:** Cập nhật thông tin mô hình sử dụng (Gemini), công thức và bảng tính toán chi phí (arithmetic) cho 1 bài lab 80 sinh viên.
3. **`AI-LOG.md`:** Ghi chép trung thực quá trình phát triển (đặc biệt là các mục `Changed`/`Rejected` về việc bẫy comment, regex, xử lý prompt).
4. **`SELF_ASSESSMENT_REPORT.md`:** Cập nhật các link commit thật vào bảng tự đánh giá.

### Git commit:
```bash
git add PA3.md README.md AI-LOG.md SELF_ASSESSMENT_REPORT.md
git commit -m "docs(pa3): update docker checker instructions, cost arithmetic and audit logs"
```

---

## BẢNG TỔNG HỢP TIẾN ĐỘ THỰC HIỆN

| Phase | Nội dung chính | Tiêu chí Rubric | File trọng tâm | Thời gian dự kiến |
| :---: | :--- | :---: | :--- | :---: |
| **0** | Chuẩn bị môi trường & Branching | — | `feature/constraint-engine` | 10 phút |
| **1** | Hard Rules Parser & Anti-Traps | **TC 3 (15đ)** | `src/checker/hard-rules.ts` | 45 phút |
| **2** | Prompt Sanitizer (Xóa comment, ẩn danh) | **TC 4 (20đ)** | `src/checker/prompt-sanitizer.ts` | 30 phút |
| **3** | Guardrails & Offline Fallbacks | **TC 5 (10đ)** | `src/checker/guardrails.ts` | 40 phút |
| **4** | LLM Client & Call Logger | **TC 4 (20đ)** | `src/checker/llm-client.ts` | 45 phút |
| **5** | Thay thế Mock Adapter | **TC 1, 3, 4** | `src/engine/constraint-adapter.ts` | 30 phút |
| **6** | Checker CLI & `MODEL_OFF=1` | **TC 6 (10đ)** | `src/checker/cli.ts`, `Dockerfile.checker` | 40 phút |
| **7** | 5 Custom Cases & Dev-Set Run | **TC 4, 6** | `custom-cases/`, `eval-results/` | 45 phút |
| **8** | Cập nhật Báo cáo & AI-LOG | **TC 8 (5đ)** | `PA3.md`, `AI-LOG.md` | 30 phút |
| **9** | Kiểm tra toàn bộ `npm run check` & PR | **TC 7 (5đ)** | Pull Request vào `main` | 15 phút |

