import from "@jac/runtime" { useParams }
import from ....components.PagePlaceholder { PagePlaceholder }
def:pub MatchSummaryPage() -> JsxPage {
    params = useParams();
    return <PagePlaceholder title="Match summary" detail={"Summary and playing-time statistics for match " + str(params["id"])} />;
}

