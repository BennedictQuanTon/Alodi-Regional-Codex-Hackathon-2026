import re,sys,zipfile,shutil
DUR={"ppt/slides/slide2.xml":20000,"ppt/slides/slide8.xml":125000}
src=sys.argv[1];tmp=src+".tmp"
zi=zipfile.ZipFile(src);zo=zipfile.ZipFile(tmp,"w",zipfile.ZIP_DEFLATED)
for it in zi.infolist():
    d=zi.read(it.filename)
    if it.filename in DUR:
        x=d.decode()
        m=re.search(r'<p:pic>.*?<p:cNvPr id="(\d+)"',x,re.S);sid=m.group(1)
        tm=f'''<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="5" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="{DUR[it.filename]}" fill="hold"/><p:tgtEl><p:spTgt spid="{sid}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq><p:video><p:cMediaNode vol="80000"><p:cTn id="7" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="{sid}"/></p:tgtEl></p:cMediaNode></p:video></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>'''
        x=re.sub(r'<p:timing>.*?</p:timing>','',x,flags=re.S)
        x=x.replace('</p:sld>',tm+'</p:sld>') if '<p:extLst>' not in x.split('</p:clrMapOvr>')[-1] else x.replace('</p:clrMapOvr>','</p:clrMapOvr>'+tm,1)
        print("spid",sid,"timing added")
        d=x.encode()
    zo.writestr(it,d)
zo.close();zi.close();shutil.move(tmp,src)
