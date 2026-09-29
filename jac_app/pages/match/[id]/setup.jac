import from "@jac/runtime" { useParams }
import from ....components.PagePlaceholder { PagePlaceholder }
def:pub MatchSetupPage() -> JsxPage {
    params = useParams();
    return <PagePlaceholder title="Match setup" detail={"Preparing match " + str(params["id"])} />;
}

