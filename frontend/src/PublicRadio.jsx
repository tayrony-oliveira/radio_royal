import { Link } from "react-router-dom";
import { newsItems } from "./data/news.js";

export default function PublicRadio() {
  const leadItem = newsItems[0];
  const listItems = newsItems.slice(1);

  return (
    <div className="public-grid">
      <section className="hero-card reveal">
        <div>
          <p className="eyebrow">Radio Royal</p>
          <h1>Radio Royal</h1>
          <p className="lead text-muted">
            Transmissao ao vivo com audio direto no navegador.
          </p>
        </div>
      </section>

      <section className="rr-layout reveal">
        <div className="rr-main">
          <div className="rr-ad">
            <img
              src="https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80"
              alt="Anuncio destaque"
            />
          </div>
          <article className="rr-lead">
            <div className="rr-lead-image">
              <img src={leadItem.image} alt={leadItem.title} />
              <span className="rr-live">Ao vivo</span>
            </div>
            <div className="rr-lead-body">
              <span className="rr-kicker">{leadItem.category}</span>
              <h2>{leadItem.title}</h2>
              <p>{leadItem.excerpt}</p>
              <ul className="rr-lead-list">
                {leadItem.content.slice(0, 3).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <Link className="rr-readmore" to={`/news/${leadItem.id}`}>
                Ler materia completa
              </Link>
            </div>
          </article>

          <div className="rr-list">
            {listItems.map((item) => (
              <Link key={item.id} to={`/news/${item.id}`} className="rr-row">
                <div className="rr-row-image">
                  <img src={item.image} alt={item.title} />
                </div>
                <div>
                  <span className="rr-kicker">{item.category}</span>
                  <h3>{item.title}</h3>
                  <p>{item.excerpt}</p>
                  <p className="rr-meta">
                    {item.time} • {item.location}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <aside className="rr-aside">
          <div className="rr-aside-card">
            <h3>Notas rapidas</h3>
            <ul>
              <li>Apple reforca foco em privacidade com novos controles.</li>
              <li>Drop surpresa de sneakers esgota em minutos.</li>
              <li>Festival indie confirma lineup para o proximo mes.</li>
              <li>Wearables voltados a bem-estar ganham espaco.</li>
            </ul>
          </div>
          <div className="rr-aside-card">
            <h3>Agenda</h3>
            <div className="agenda">
              <div>
                <span className="agenda-time">Qua 20h</span>
                <p>Live set disco-funk + DJ residente.</p>
              </div>
              <div>
                <span className="agenda-time">Qui 19h</span>
                <p>Review rapido de gadgets e tendencias mobile.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
