import from "@jac/runtime" { useParams }
import from ....components.PagePlaceholder { PagePlaceholder }
def:pub LiveMatchPage() -> JsxPage {
    params = useParams();
    return <PagePlaceholder title="Live match" detail={"Live controls for match " + str(params["id"]) + " will use the ported clock and event engine."} />;
}

