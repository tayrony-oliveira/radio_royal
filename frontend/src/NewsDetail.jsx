import { Link, useParams } from "react-router-dom";
import { newsItems } from "./data/news.js";

export default function NewsDetail() {
  const { id } = useParams();
  const item = newsItems.find((news) => news.id === id);

  if (!item) {
    return (
      <div className="news-detail">
        <p className="text-muted">Materia nao encontrada.</p>
        <Link className="rr-readmore" to="/">
          Voltar para a capa
        </Link>
      </div>
    );
  }

  return (
    <div className="news-detail">
      <Link className="rr-readmore" to="/">
        Voltar para a capa
      </Link>
      <div className="news-hero">
        <img src={item.image} alt={item.title} />
      </div>
      <div className="news-meta">
        <span className="rr-kicker">{item.category}</span>
        <span className="rr-meta">
          {item.time} • {item.location}
        </span>
      </div>
      <h1>{item.title}</h1>
      <p className="news-excerpt">{item.excerpt}</p>
      <div className="news-body">
        {item.content.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
