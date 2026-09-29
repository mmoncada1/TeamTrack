def:pub PagePlaceholder(title: str, detail: str) -> JsxElement {
    <section className="page narrow-page">
        <h1>{title}</h1>
        <div className="notice">
            <strong>Migration in progress</strong>
            <p>{detail}</p>
        </div>
    </section>
}

