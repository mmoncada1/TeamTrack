"""Apply TeamTrack's site palette to the Pandoc-generated PPTX."""

from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZipFile
import xml.etree.ElementTree as ET

PPTX = Path(__file__).with_name("TeamTrack-pitch.pptx")
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
ns = {"a": A, "p": P}
ET.register_namespace("a", A)
ET.register_namespace("p", P)


def set_color(parent, rgb):
    for child in list(parent):
        if child.tag in {f"{{{A}}}solidFill", f"{{{A}}}schemeClr"}:
            parent.remove(child)
    fill = ET.SubElement(parent, f"{{{A}}}solidFill")
    ET.SubElement(fill, f"{{{A}}}srgbClr", {"val": rgb})


def style_slide(data, slide_num):
    root = ET.fromstring(data)
    c_sld = root.find("p:cSld", ns)
    bg = c_sld.find("p:bg", ns)
    if bg is None:
        bg = ET.Element(f"{{{P}}}bg")
        c_sld.insert(0, bg)
    for child in list(bg):
        bg.remove(child)
    bg_pr = ET.SubElement(bg, f"{{{P}}}bgPr")
    set_color(bg_pr, "064E3B" if slide_num == 1 else "0F172A")
    ET.SubElement(bg_pr, f"{{{A}}}effectLst")

    for shape_index, shape in enumerate(root.findall(".//p:sp", ns)):
        heading = shape_index == 0
        color = "6EE7B7" if heading and slide_num != 1 else "F8FAFC" if heading else "CBD5E1"
        for run in shape.findall(".//a:r", ns):
            props = run.find("a:rPr", ns)
            if props is None:
                props = ET.Element(f"{{{A}}}rPr")
                run.insert(0, props)
            set_color(props, color)
            props.set("b", "1" if heading else props.get("b", "0"))
            latin = props.find("a:latin", ns)
            if latin is None:
                latin = ET.SubElement(props, f"{{{A}}}latin")
            latin.set("typeface", "Aptos")
        for props in shape.findall(".//a:endParaRPr", ns):
            set_color(props, color)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


with NamedTemporaryFile(dir=PPTX.parent, suffix=".pptx", delete=False) as tmp:
    temp_path = Path(tmp.name)
try:
    with ZipFile(PPTX) as source, ZipFile(temp_path, "w") as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename.startswith("ppt/slides/slide") and item.filename.endswith(".xml"):
                number = int(item.filename.removeprefix("ppt/slides/slide").removesuffix(".xml"))
                data = style_slide(data, number)
            target.writestr(item, data)
    temp_path.replace(PPTX)
finally:
    temp_path.unlink(missing_ok=True)
