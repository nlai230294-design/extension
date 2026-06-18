const OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
];

function RiskFilter({ value, onChange }) {
  return (
    <div className="risk-filter">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`risk-filter__option ${
            value === option.value ? "risk-filter__option--active" : ""
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default RiskFilter;
