from pathlib import Path
import textwrap

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images"
OUT.mkdir(parents=True, exist_ok=True)

NAVY = "#243B5A"
BLUE = "#DCEEFF"
GREEN = "#E1F4E7"
PURPLE = "#EAE3FF"
YELLOW = "#FFF0C7"
GRAY = "#F4F6F8"
EDGE = "#58708E"
ORANGE_EDGE = "#C76B00"
PURPLE_EDGE = "#6437D8"


def canvas(title, width=14, height=8):
    fig, ax = plt.subplots(figsize=(width, height), dpi=220)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")
    ax.set_xlim(0, width)
    ax.set_ylim(0, height)
    ax.axis("off")
    ax.text(
        width / 2,
        height - 0.34,
        title,
        ha="center",
        va="center",
        fontsize=17,
        fontweight="bold",
        color="#102A43",
    )
    return fig, ax


def box(ax, x, y, w, h, title, subtitle="", face=BLUE, edge="#0877B9", title_size=11.5):
    patch = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle="round,pad=0.025,rounding_size=0.18",
        linewidth=1.25,
        edgecolor=edge,
        facecolor=face,
        zorder=3,
    )
    ax.add_patch(patch)
    ax.text(
        x + w / 2,
        y + h * 0.64,
        title,
        ha="center",
        va="center",
        fontsize=title_size,
        fontweight="bold",
        color="#102A43",
        zorder=4,
    )
    if subtitle:
        wrapped = textwrap.fill(subtitle, width=max(18, int(w * 9)))
        ax.text(
            x + w / 2,
            y + h * 0.30,
            wrapped,
            ha="center",
            va="center",
            fontsize=9.2,
            linespacing=1.35,
            color="#243B5A",
            zorder=4,
        )
    return {"x": x, "y": y, "w": w, "h": h}


def namespace(ax, x, y, w, h, label):
    patch = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle="round,pad=0.03,rounding_size=0.20",
        linewidth=1.1,
        edgecolor="#9AAEC4",
        facecolor="#F7F9FB",
        zorder=0,
    )
    ax.add_patch(patch)
    ax.text(x + 0.25, y + h - 0.28, label, fontsize=10.5, fontweight="bold", color="#40566F")


def connect(ax, points, label=None, label_at=None, color=NAVY, lw=1.6, ls="-"):
    xs, ys = zip(*points)
    ax.plot(xs, ys, color=color, linewidth=lw, linestyle=ls, zorder=1)
    ax.add_patch(
        FancyArrowPatch(
            points[-2],
            points[-1],
            arrowstyle="-|>",
            mutation_scale=15,
            linewidth=0,
            color=color,
            zorder=2,
        )
    )
    if label:
        x, y = label_at or points[len(points) // 2]
        ax.text(
            x,
            y,
            label,
            fontsize=8.7,
            fontweight="bold",
            color=color,
            ha="center",
            va="center",
            bbox={"facecolor": "white", "edgecolor": "none", "pad": 1.5},
            zorder=5,
        )


def save(fig, name):
    fig.savefig(OUT / name, dpi=220, bbox_inches="tight", pad_inches=0.10)
    plt.close(fig)


def system_architecture():
    fig, ax = canvas("Kiến trúc triển khai Philobiblus trên GKE")
    namespace(ax, 4.55, 2.1, 8.75, 4.65, "Namespace philobiblus")

    browser = box(ax, 0.30, 5.05, 2.05, 1.20, "Trình duyệt", "React SPA", BLUE)
    gateway = box(ax, 2.82, 4.88, 1.90, 1.48, "GKE Gateway", "HTTPRoute /api\nCloud Armor", YELLOW, ORANGE_EDGE)
    frontend = box(ax, 5.05, 5.02, 2.35, 1.25, "Frontend", "Vite build và NGINX", BLUE)
    backend = box(ax, 8.15, 5.02, 2.55, 1.25, "FastAPI backend", "JWT, nghiệp vụ, metrics", GREEN, "#168A45")
    redis = box(ax, 5.30, 3.18, 2.35, 1.15, "Redis", "Cache và rate limit", PURPLE, PURPLE_EDGE)
    reco = box(ax, 8.55, 3.18, 2.65, 1.15, "Recommendation", "TF-IDF artifact", PURPLE, PURPLE_EDGE)
    observ = box(ax, 0.55, 0.40, 3.20, 1.15, "Quan sát hệ thống", "Cloud Monitoring, Logging, Prometheus", GRAY, EDGE)
    gcs = box(ax, 5.20, 0.40, 2.85, 1.15, "GCS và MLflow", "Model, release, run metadata", GRAY, EDGE)
    sql = box(ax, 9.45, 0.40, 3.05, 1.15, "Cloud SQL PostgreSQL", "Cloud SQL Auth Proxy", YELLOW, ORANGE_EDGE)

    connect(ax, [(2.35, 5.65), (2.82, 5.65)], "HTTPS", (2.58, 5.84))
    connect(ax, [(4.72, 5.86), (5.05, 5.86)], "/", (4.88, 6.02))
    connect(ax, [(4.72, 5.20), (5.00, 4.86), (8.15, 4.86), (8.15, 5.26)], "/api", (6.45, 4.72))
    connect(ax, [(8.60, 5.02), (8.00, 4.70), (7.65, 4.33)], "cache", (8.16, 4.64))
    connect(ax, [(9.55, 5.02), (9.85, 4.42)], "recommend", (10.10, 4.76))
    connect(ax, [(10.35, 5.02), (11.75, 4.72), (11.75, 1.92), (11.00, 1.55)], "SQL", (12.02, 3.35))
    connect(ax, [(9.70, 3.18), (9.70, 2.00), (8.55, 1.72), (7.20, 1.55)], "artifact", (8.62, 1.83))
    connect(ax, [(8.25, 5.14), (8.00, 2.00), (4.35, 2.00), (4.35, 1.05), (3.75, 0.98)], "metrics / traces", (6.15, 2.14))

    save(fig, "system-architecture.png")


def mlops_pipeline():
    fig, ax = canvas("Vòng đời dữ liệu và mô hình gợi ý")
    top = [
        box(ax, 0.30, 5.25, 2.05, 1.05, "Catalog công khai", "PostgreSQL", BLUE),
        box(ax, 2.75, 5.25, 2.05, 1.05, "Snapshot", "Parquet, hash logic", GREEN, "#168A45"),
        box(ax, 5.20, 5.25, 2.15, 1.05, "Kiểm tra dữ liệu", "Schema và catalog delta", GREEN, "#168A45"),
        box(ax, 7.75, 5.25, 2.20, 1.05, "Chuẩn bị đặc trưng", "Title, author, tags", GREEN, "#168A45"),
        box(ax, 10.35, 5.25, 2.25, 1.05, "Huấn luyện TF-IDF", "Sparse feature matrix", GREEN, "#168A45"),
    ]
    fetcher = box(ax, 0.55, 2.55, 2.35, 1.05, "Model fetcher", "SHA-256 và schema", GREEN, "#168A45")
    gcs = box(ax, 3.45, 2.55, 2.65, 1.05, "GCS artifact", "Model và release manifest", PURPLE, PURPLE_EDGE)
    mlflow = box(ax, 6.65, 2.55, 2.65, 1.05, "MLflow Registry", "Run, metric, candidate", PURPLE, PURPLE_EDGE)
    quality = box(ax, 9.85, 2.55, 2.65, 1.05, "Quality gate", "Hit-rate, coverage, regression", YELLOW, ORANGE_EDGE)
    rec = box(ax, 2.10, 0.48, 3.00, 1.00, "Recommendation service", "Nạp release đã duyệt", BLUE)
    champion = box(ax, 8.90, 0.48, 3.00, 1.00, "Giữ nguyên champion", "Candidate thiếu dữ liệu hoặc không đạt", GRAY, EDGE)

    for left, right in zip(top, top[1:]):
        connect(ax, [(left["x"] + left["w"], left["y"] + left["h"] / 2), (right["x"], right["y"] + right["h"] / 2)])
    connect(ax, [(11.48, 5.25), (11.48, 4.35), (11.20, 3.60)], "đạt", (11.74, 4.30))
    connect(ax, [(9.85, 3.08), (9.30, 3.08)], None)
    connect(ax, [(6.65, 3.08), (6.10, 3.08)], None)
    connect(ax, [(3.45, 3.08), (2.90, 3.08)], None)
    connect(ax, [(1.72, 2.55), (2.60, 1.48)], None)
    connect(ax, [(5.10, 0.98), (6.10, 0.98), (6.65, 2.55)], "health check và rollback", (5.75, 1.78))
    connect(ax, [(11.18, 2.55), (10.60, 1.48)], "không đạt", (11.30, 1.93), color="#C62828")
    save(fig, "mlops-pipeline.png")


def devsecops_pipeline():
    fig, ax = canvas("Chuỗi kiểm soát DevSecOps từ commit đến GKE")
    commit = box(ax, 0.35, 5.25, 2.05, 1.05, "Commit và PR", "GitHub", BLUE)
    tests = box(ax, 2.95, 5.25, 2.20, 1.05, "Kiểm thử", "Backend, ML, frontend", GREEN, "#168A45")
    security = box(ax, 5.70, 5.10, 2.55, 1.35, "Phân tích bảo mật", "Gitleaks và Semgrep\npip-audit, npm audit\nTrivy", YELLOW, ORANGE_EDGE)
    artifact = box(ax, 8.85, 5.25, 2.25, 1.05, "Artefact", "Image digest, SBOM\nCosign signature", PURPLE, PURPLE_EDGE)
    deploy = box(ax, 11.65, 5.25, 2.05, 1.05, "Triển khai GKE", "Helm và Terraform", PURPLE, PURPLE_EDGE)
    runtime = box(ax, 5.85, 3.10, 2.35, 0.95, "Runtime enforcement", "Policy và probe", GRAY, EDGE)
    edge = box(ax, 0.95, 0.72, 3.00, 1.05, "Biên mạng", "Gateway và Cloud Armor", YELLOW, ORANGE_EDGE)
    cluster = box(ax, 5.45, 0.72, 3.00, 1.05, "Trong cluster", "NetworkPolicy và securityContext", YELLOW, ORANGE_EDGE)
    app = box(ax, 9.95, 0.72, 3.00, 1.05, "Trong ứng dụng", "JWT, ownership, Redis rate limit", YELLOW, ORANGE_EDGE)

    connect(ax, [(2.40, 5.78), (2.95, 5.78)])
    connect(ax, [(5.15, 5.78), (5.70, 5.78)])
    connect(ax, [(8.25, 5.78), (8.85, 5.78)])
    connect(ax, [(11.10, 5.78), (11.65, 5.78)])
    connect(ax, [(12.68, 5.25), (12.68, 4.55), (8.20, 3.58)], "enforce", (10.55, 4.35))
    connect(ax, [(7.02, 3.10), (7.02, 2.50), (2.45, 2.50), (2.45, 1.77)])
    connect(ax, [(7.02, 2.50), (6.95, 1.77)])
    connect(ax, [(7.02, 2.50), (11.45, 2.50), (11.45, 1.77)])
    ax.text(7.0, 0.18, "Một kiểm soát đơn lẻ không thay thế các lớp còn lại", ha="center", fontsize=10, fontweight="bold", color="#526579")
    save(fig, "devsecops-pipeline.png")


if __name__ == "__main__":
    system_architecture()
    mlops_pipeline()
    devsecops_pipeline()
