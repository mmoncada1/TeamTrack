"""Render a visual TeamTrack pitch and package it as a PowerPoint deck."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from zipfile import ZipFile
from tempfile import NamedTemporaryFile
import xml.etree.ElementTree as ET
import subprocess

ROOT = Path(__file__).parent
DECK = ROOT / "TeamTrack-pitch.pptx"
OUT = ROOT / "slides"
OUT.mkdir(exist_ok=True)
W, H = 1600, 900
NAVY, PANEL, GREEN, MINT = "#0f172a", "#1e293b", "#047857", "#6ee7b7"
WHITE, MUTED, LINE = "#f8fafc", "#cbd5e1", "#334155"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def font(size, bold=False): return ImageFont.truetype(BOLD if bold else FONT, size)
def text(d, xy, value, size=34, color=WHITE, bold=False): d.text(xy, value, font=font(size,bold), fill=color)
def box(d, xy, fill=PANEL, outline=LINE, radius=26): d.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=2)
def lines(d, x, y, items, size=29, gap=52, color=MUTED):
    for item in items:
        text(d,(x,y),item,size,color); y+=gap
def base(n, section):
    im=Image.new("RGB",(W,H),NAVY); d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,12),fill=GREEN)
    text(d,(90,50),"TEAMTRACK",25,MINT,True)
    text(d,(1350,52),f"{n:02d} / 07",20,"#94a3b8")
    d.line((90,833,1510,833),fill=LINE,width=2)
    text(d,(90,850),section.upper(),17,"#94a3b8",True)
    return im,d
def title(d, label, headline, sub=None):
    text(d,(90,118),label.upper(),22,MINT,True)
    text(d,(90,170),headline,54,WHITE,True)
    if sub: text(d,(92,246),sub,26,MUTED)
def field(d, x,y,w,h):
    d.rounded_rectangle((x,y,x+w,y+h),radius=22,fill="#14532d",outline="#34d399",width=3)
    d.rectangle((x+24,y+22,x+w-24,y+h-22),outline="#d1fae5",width=3)
    d.line((x+w//2,y+22,x+w//2,y+h-22),fill="#d1fae5",width=3)
    d.ellipse((x+w//2-56,y+h//2-56,x+w//2+56,y+h//2+56),outline="#d1fae5",width=3)
    for dx,dy in [(0.22,.26),(.35,.7),(.65,.32),(.77,.73)]:
        px=x+int(w*dx); py=y+int(h*dy)
        d.ellipse((px-19,py-19,px+19,py+19),fill=MINT,outline=WHITE,width=3)

slides=[]
im,d=base(1,"the pitch")
text(d,(90,230),"TEAMTRACK",84,WHITE,True)
text(d,(94,345),"Your team. Your lineup.",49,MINT,True)
text(d,(94,414),"Your match day.",49,MINT,True)
text(d,(97,535),"One sideline workspace for coaches.",29,MUTED)
field(d,1000,164,470,548)
slides.append(im)

im,d=base(2,"the problem"); title(d,"the problem","Game day gets scattered")
for i,(head,body) in enumerate([("Roster","Who is available?"),("Lineup","Who is on the field?"),("Match log","What happened?")]):
    x=90+i*485; box(d,(x,345,x+445,665))
    text(d,(x+34,382),f"0{i+1}",25,MINT,True)
    text(d,(x+34,465),head,39,WHITE,True)
    text(d,(x+34,530),body,26,MUTED)
text(d,(91,712),"Coaches need all three answers while the clock is running.",27,MINT)
slides.append(im)

im,d=base(3,"the product"); title(d,"the product","One flow, start to finish")
for i,(head,a,b) in enumerate([("01  PREPARE","Create a team","Roster + saved lineup"),("02  COACH","Run a match","Clock + subs + events"),("03  REVIEW","See the recap","History + summary")]):
    x=90+i*485; box(d,(x,345,x+445,674),GREEN if i==1 else PANEL)
    text(d,(x+30,384),head,22,MINT if i!=1 else WHITE,True)
    text(d,(x+30,463),a,36,WHITE,True)
    text(d,(x+30,529),b,25,"#d1fae5" if i==1 else MUTED)
    if i<2: text(d,(x+455,482),"→",30,MINT,True)
slides.append(im)

im,d=base(4,"why try it"); title(d,"why it helps","A clearer view from the sideline")
box(d,(90,330,915,744)); field(d,126,366,450,340)
box(d,(610,390,868,485),"#064e3b","#10b981",14)
text(d,(636,407),"MATCH LIVE",22,MINT,True)
text(d,(636,445),"24:18  |  2–1",25,WHITE,True)
text(d,(610,530),"Field + bench",27,WHITE,True)
text(d,(610,583),"Player minutes",27,WHITE,True)
text(d,(610,636),"Match events",27,WHITE,True)
box(d,(960,330,1510,744))
text(d,(995,375),"Built for decisions",32,WHITE,True)
lines(d,995,455,["Spot playing-time needs","Make substitutions quickly","Review AI suggestions first","Keep a match record"],25,57)
slides.append(im)

im,d=base(5,"live demo"); title(d,"show it in action","Coach one match in 3 minutes")
steps=[("1","OPEN","Prepared team + lineup"),("2","START","Kick off the match"),("3","SUBSTITUTE","Move a bench player in"),("4","RECORD","Log a goal; view summary")]
for i,(num,head,body) in enumerate(steps):
    y=325+i*111; box(d,(90,y,1510,y+92),PANEL)
    d.ellipse((113,y+16,173,y+76),fill=GREEN)
    text(d,(133,y+27),num,25,WHITE,True)
    text(d,(205,y+22),head,24,MINT,True)
    text(d,(545,y+22),body,28,WHITE)
slides.append(im)

im,d=base(6,"bonus"); title(d,"optional demo","Ask for better substitutions")
box(d,(90,340,860,704))
text(d,(130,381),"COACH",22,MINT,True)
box(d,(130,432,783,522),"#334155","#475569",18)
text(d,(156,458),'“Make 3 best subs”',27,WHITE)
text(d,(130,571),"Review each proposed swap",30,WHITE,True)
text(d,(130,625),"Accept or skip before anything changes.",24,MUTED)
box(d,(910,340,1510,704),"#064e3b","#10b981")
text(d,(955,391),"Coach stays in control",31,WHITE,True)
lines(d,955,472,["Suggestions use match context","Lineup rules are checked","No automatic substitutions"],25,58,"#d1fae5")
slides.append(im)

im,d=base(7,"try it"); title(d,"try teamtrack","Take it for a spin")
box(d,(90,320,1510,708),"#064e3b","#10b981")
text(d,(142,363),"GET THE PROJECT",22,MINT,True)
text(d,(142,419),"github.com/mmoncada1/TeamTrack",41,WHITE,True)
d.line((142,482,1452,482),fill="#10b981",width=3)
text(d,(142,520),"1   Install Jac 0.37.23",27,WHITE)
text(d,(142,575),"2   Run jac install  →  jac run --dev",27,WHITE)
text(d,(142,630),"3   Open localhost:8000 and create a team",27,WHITE)
slides.append(im)

for i,im in enumerate(slides,1): im.save(OUT/f"slide{i}.png",quality=95)

# Pandoc supplies valid editable presentation structure; replace the slide
# contents with full-bleed visuals. The source markdown remains editable.
subprocess.run(["pandoc",str(ROOT/"TeamTrack-pitch.md"),"-t","pptx","-o",str(DECK)],check=True)
P="http://schemas.openxmlformats.org/presentationml/2006/main"
A="http://schemas.openxmlformats.org/drawingml/2006/main"
R="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL="http://schemas.openxmlformats.org/package/2006/relationships"
ET.register_namespace("p",P); ET.register_namespace("a",A); ET.register_namespace("r",R)
with NamedTemporaryFile(dir=ROOT,suffix=".pptx",delete=False) as temp:
    tmp=Path(temp.name)
try:
    with ZipFile(DECK) as src,ZipFile(tmp,"w") as dst:
        for item in src.infolist():
            name=item.filename; data=src.read(name)
            if name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                n=int(name.removeprefix("ppt/slides/slide").removesuffix(".xml"))
                root=ET.fromstring(data); c=root.find(f"{{{P}}}cSld"); tree=c.find(f"{{{P}}}spTree")
                for child in list(tree)[2:]: tree.remove(child)
                pic=ET.SubElement(tree,f"{{{P}}}pic")
                nv=ET.SubElement(pic,f"{{{P}}}nvPicPr")
                ET.SubElement(nv,f"{{{P}}}cNvPr",{"id":"100","name":f"TeamTrack slide {n}"})
                ET.SubElement(nv,f"{{{P}}}cNvPicPr")
                ET.SubElement(nv,f"{{{P}}}nvPr")
                fill=ET.SubElement(pic,f"{{{P}}}blipFill")
                ET.SubElement(fill,f"{{{A}}}blip",{f"{{{R}}}embed":"rId99"})
                stretch=ET.SubElement(fill,f"{{{A}}}stretch"); ET.SubElement(stretch,f"{{{A}}}fillRect")
                sp=ET.SubElement(pic,f"{{{P}}}spPr"); xf=ET.SubElement(sp,f"{{{A}}}xfrm")
                ET.SubElement(xf,f"{{{A}}}off",{"x":"0","y":"0"})
                ET.SubElement(xf,f"{{{A}}}ext",{"cx":"9144000","cy":"5143500"})
                geom=ET.SubElement(sp,f"{{{A}}}prstGeom",{"prst":"rect"}); ET.SubElement(geom,f"{{{A}}}avLst")
                data=ET.tostring(root,encoding="utf-8",xml_declaration=True)
            elif name.startswith("ppt/slides/_rels/slide") and name.endswith(".xml.rels"):
                n=int(name.removeprefix("ppt/slides/_rels/slide").removesuffix(".xml.rels"))
                root=ET.fromstring(data)
                ET.SubElement(root,f"{{{REL}}}Relationship",{"Id":"rId99","Type":R+"/image","Target":f"../media/teamtrack-slide{n}.png"})
                data=ET.tostring(root,encoding="utf-8",xml_declaration=True)
            elif name=="[Content_Types].xml":
                root=ET.fromstring(data); ct="http://schemas.openxmlformats.org/package/2006/content-types"
                if not any(e.get("Extension")=="png" for e in root): ET.SubElement(root,f"{{{ct}}}Default",{"Extension":"png","ContentType":"image/png"})
                data=ET.tostring(root,encoding="utf-8",xml_declaration=True)
            dst.writestr(item,data)
        for n in range(1,8): dst.write(OUT/f"slide{n}.png",f"ppt/media/teamtrack-slide{n}.png")
    tmp.replace(DECK)
finally: tmp.unlink(missing_ok=True)
