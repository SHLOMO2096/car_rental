import { s } from "../styles";

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <div style={s.pagination}>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            ...s.pageBtn,
            background: p === page ? "#1d4ed8" : "#f1f5f9",
            color: p === page ? "#fff" : "#475569",
          }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

