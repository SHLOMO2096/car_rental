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
            background: p === page ? "#154038" : "#eff3f1",
            color: p === page ? "#fff" : "#59605d",
          }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

