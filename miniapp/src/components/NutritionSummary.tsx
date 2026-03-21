interface Props {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  normCalories?: number | null;
  normProtein?: number | null;
  normFat?: number | null;
  normCarbs?: number | null;
}

export default function NutritionSummary({ calories, protein, fat, carbs, fiber, normCalories, normProtein, normFat, normCarbs }: Props) {
  const pct = normCalories ? Math.min(100, Math.round((calories / normCalories) * 100)) : null;
  return (
    <div>
      <div className="stat-row">
        <span className="stat-label">🔥 Калории</span>
        <span className="stat-value">{calories} {normCalories ? `/ ${normCalories}` : ''} ккал{pct !== null ? ` (${pct}%)` : ''}</span>
      </div>
      {pct !== null && <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>}
      <div className="stat-row">
        <span className="stat-label">💪 Белки</span>
        <span className="stat-value">{protein.toFixed(1)}{normProtein ? ` / ${normProtein}` : ''} г</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">🧈 Жиры</span>
        <span className="stat-value">{fat.toFixed(1)}{normFat ? ` / ${normFat}` : ''} г</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">🌾 Углеводы</span>
        <span className="stat-value">{carbs.toFixed(1)}{normCarbs ? ` / ${normCarbs}` : ''} г</span>
      </div>
      {fiber !== undefined && (
        <div className="stat-row">
          <span className="stat-label">🥦 Клетчатка</span>
          <span className="stat-value">{fiber.toFixed(1)} г</span>
        </div>
      )}
    </div>
  );
}
