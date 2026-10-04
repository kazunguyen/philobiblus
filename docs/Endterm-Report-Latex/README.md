# Endterm Report LaTeX

Đây là bản chuyển đổi LaTeX từ `BAO_CAO_THUC_TAP.doc`. Biên dịch bằng XeLaTeX:

```powershell
cd Endterm-Report-Latex
xelatex -interaction=nonstopmode -file-line-error main.tex
bibtex main
xelatex -interaction=nonstopmode -file-line-error main.tex
xelatex -interaction=nonstopmode -file-line-error main.tex
```

Các ảnh được dùng trong báo cáo nằm ở `images/`. Bản chuyển đổi giữ nguyên nội dung, thứ tự mục và các hình chính của báo cáo Word; một số bảng bố trí của Word được dựng lại bằng `tabularx` để ổn định khi biên dịch.

## Ghi chú đối chiếu định dạng

- Khổ giấy A4, chữ chính Times New Roman 12 pt, căn lề trái/phải 2 cm và lề trên/dưới 2 cm; thân bài dùng thụt đầu dòng 1 cm và giãn dòng 1,5.
- Bìa được dựng lại trên một trang riêng với nền trắng, khung vuông nhiều lớp và các bậc góc đậm, chữ đen/đỏ, logo, tên báo cáo, ngành, đề tài, thông tin hướng dẫn/đánh giá và ngày tháng. Mục lục bắt đầu ở trang kế tiếp, không đặt chung với bìa.
- Các đề mục cấp I dùng chữ đậm 14 pt; các đề mục con được giữ đúng trạng thái đậm hoặc thường theo các đoạn định dạng trong file `.doc`. Danh mục hình dùng bảng ba cột để giữ số hình, mô tả và số trang thẳng hàng.
- Sáu hình được đặt ở các trang riêng tương ứng với luồng nội dung Word. Hai trang nhận xét cuối báo cáo giữ khác biệt của bản gốc: trang đầu không có logo, trang sau có logo trường.
- Bố cục được kiểm tra trực quan sau hai lần biên dịch XeLaTeX. Do `.doc` là định dạng Word nhị phân cũ, một số thông số nội bộ của bảng/đối tượng nổi không thể đọc chính xác tuyệt đối; các vị trí được dựng theo cấu trúc bảng và dấu ngắt trang quan sát được từ bản gốc.

## Cấu trúc mã nguồn

- `main.tex`: preamble và thứ tự ghép tài liệu.
- `chapters/cover.tex`: bìa độc lập.
- `chapters/contents.tex`, `acknowledgements.tex`, `figures-list.tex`: phần đầu báo cáo.
- `chapters/chapter1.tex` đến `chapter5.tex`: năm chương nội dung.
- `chapters/references.tex`, `signatures.tex`: tài liệu tham khảo và trang nhận xét/ký xác nhận.
- `tools/generate_diagrams.py`: tạo lại ba sơ đồ kiến trúc bằng Matplotlib với các connector được định tuyến thủ công, giữ đường nối ngoài vùng node để tránh chồng lấn khi xuất ảnh.

Lệnh biên dịch tạo `main.pdf` 20 trang; log cuối không có lỗi, cảnh báo `Overfull \\hbox` hoặc mục tham chiếu chưa định nghĩa.

Các trích dẫn trong nội dung dùng lệnh cite và lấy dữ liệu từ references.bib. Sau lần biên dịch đầu tiên cần chạy BibTeX rồi biên dịch XeLaTeX thêm hai lần để số thứ tự và liên kết nội bộ ổn định.

Để cập nhật các sơ đồ sau khi chỉnh mã nguồn, chạy `python tools/generate_diagrams.py` trước khi biên dịch báo cáo. Graphviz/TikZ là các lựa chọn phổ biến cho bài báo; trong môi trường này Graphviz CLI không có sẵn nên script dùng Matplotlib, một thư viện đã có trong Python, để việc tái tạo ảnh không phụ thuộc công cụ ngoài.
