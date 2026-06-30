import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useDailyTip } from '../hooks/useDailyTip';
import CyberBg from '../components/CyberBg';
import './HomePage.css';

interface NameForm {
  name: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { playerName, setPlayerName } = usePlayer();
  const { tip, loading: tipLoading } = useDailyTip();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<NameForm>({ defaultValues: { name: playerName }, mode: 'onChange' });

  const name = watch('name');
  const valid = name.trim().length >= 2;

  function goTo(path: string) {
    return handleSubmit(data => {
      setPlayerName(data.name.trim());
      navigate(path);
    });
  }

  return (
    <>
      <CyberBg />
      <div className="game-select">
        <h1 className="gs-title">ARCADE</h1>
        <p className="gs-subtitle">Elige un juego</p>

        <form className="gs-name-field" onSubmit={goTo('/lobby')}>
          <label className="cyber-label" htmlFor="gs-name">Nombre de jugador</label>
          <input
            id="gs-name"
            className="cyber-input gs-name-input"
            type="text"
            maxLength={18}
            placeholder="INTRODUCE TU NOMBRE"
            autoComplete="off"
            autoFocus={!playerName}
            {...register('name', { required: true, minLength: 2 })}
          />
          {errors.name && (
            <span className="gs-hint">mín. 2 caracteres</span>
          )}
        </form>

        <div className="gs-cards">
          <button className="gs-card" onClick={goTo('/lobby')} disabled={!valid}>
            <span className="gs-card-icon">🔵</span>
            <span className="gs-card-name">Conecta 4</span>
            <span className="gs-card-desc">2 jugadores · IA opcional</span>
          </button>
          <button className="gs-card" onClick={goTo('/snake')} disabled={!valid}>
            <span className="gs-card-icon">🐍</span>
            <span className="gs-card-name">Snake.io</span>
            <span className="gs-card-desc">2–8 jugadores · tiempo real</span>
          </button>
        </div>

        {!tipLoading && <p className="gs-tip">SYS_TIP: {tip}</p>}
      </div>
    </>
  );
}
