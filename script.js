window.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById("canvasRender");
    const motore = new BABYLON.Engine(canvas, true);
    const schoolInfo = document.getElementById("schoolInfo");
    const yearInfo = document.getElementById("yearInfo");
    const overlayMenu = document.getElementById("menuPrincipale");
    const btnGioca = document.getElementById("btnGioca");
    const btnClassifica = document.getElementById("btnClassifica");
    const btnEsci = document.getElementById("btnEsci");
    const btnRiavvia = document.getElementById("btnRiavvia");
    const btnMenu = document.getElementById("btnMenu");
    const btnChiudiClassifica = document.getElementById("btnChiudiClassifica");
    const divPunteggio = document.getElementById("punteggio");
    const divFine = document.getElementById("finestraFine");
    const testoFine = document.getElementById("testoFine");
    const divClassifica = document.getElementById("finestraClassifica");
    const testoClassifica = document.getElementById("testoClassifica");

    canvas.style.display = "none";

    let scena = null;
    let punteggio = 0;
    const velocitàBase = 20;
    let velocitàGioco = velocitàBase;
    let accelerazione = 0.5;
    let fineGioco = false;
    let ostacoli = [];
    let tempoUltimoOstacolo = 0;

    const intervalloOstacoli = 1.5;
    const corsie = [-4, 0, 4];
    let obiettivoZ = 0;
    const velocitàLaterale = 25;

    const lunghezzaPavimento = 100;
    let segmentiPavimento = [];
    let prossimoInizio = -lunghezzaPavimento;

    const ultimoSpawnCorsia = [-Infinity, -Infinity, -Infinity];
    const distanzaSpawn = 80;
    const gapMinimo = 20;
    const distanzaRimozione = 10;

    const dimensioneGiocatore = 1.5;
    let giocatore, materialeGiocatore;
    const probabilitaArcobaleno = 0.05;
    let giocoAvviato = false;

    function hsvToRgb(h, s, v) {
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        let r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        return [r + m, g + m, b + m];
    }

    function creaScena() {
        const scn = new BABYLON.Scene(motore);
        scn.clearColor = new BABYLON.Color4(0, 0, 0, 1);
        scn.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), new BABYLON.CannonJSPlugin());

        const telecamera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(-12, 6, 0), scn);
        telecamera.setTarget(BABYLON.Vector3.Zero());
        telecamera.attachControl(canvas, true);
        telecamera.inputs.clear();

        new BABYLON.HemisphericLight("luceEmisferica", new BABYLON.Vector3(0, 1, 0), scn).intensity = 0.9;
        new BABYLON.DirectionalLight("luceDirezionale", new BABYLON.Vector3(0.5, -1, 1), scn).intensity = 0.6;

        for (let i = 0; i < 3; i++) {
            const inizio = prossimoInizio;
            const centro = inizio + lunghezzaPavimento / 2;
            const pavimento = BABYLON.MeshBuilder.CreateGround(
                "pavimento",
                { width: lunghezzaPavimento, height: 12 },
                scn
            );
            pavimento.position = new BABYLON.Vector3(centro, 0, 0);
            const mat = new BABYLON.StandardMaterial("matPavimento", scn);
            mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
            pavimento.material = mat;
            pavimento.physicsImpostor = new BABYLON.PhysicsImpostor(
                pavimento,
                BABYLON.PhysicsImpostor.BoxImpostor,
                { mass: 0, restitution: 0 },
                scn
            );

            const lineeCorsia = [];
            corsie.forEach(z => {
                const linea = BABYLON.MeshBuilder.CreateLines("linea", {
                    points: [
                        new BABYLON.Vector3(inizio, 0.02, z),
                        new BABYLON.Vector3(inizio + lunghezzaPavimento, 0.02, z)
                    ]
                }, scn);
                linea.color = new BABYLON.Color3(0, 0, 0);
                lineeCorsia.push(linea);
            });

            segmentiPavimento.push({ mesh: pavimento, linee: lineeCorsia, inizio: inizio });
            prossimoInizio += lunghezzaPavimento;
        }

        giocatore = BABYLON.MeshBuilder.CreateBox("giocatore", { size: dimensioneGiocatore }, scn);
        giocatore.position = new BABYLON.Vector3(0, dimensioneGiocatore / 2, 0);

        materialeGiocatore = new BABYLON.StandardMaterial("matGiocatore", scn);
        materialeGiocatore.diffuseColor = new BABYLON.Color3(1, 1, 1);
        giocatore.material = materialeGiocatore;
        giocatore.enableEdgesRendering();
        giocatore.edgesWidth = 2.0;
        giocatore.edgesColor = new BABYLON.Color4(0, 0, 0, 1);

        giocatore.physicsImpostor = new BABYLON.PhysicsImpostor(
            giocatore,
            BABYLON.PhysicsImpostor.NoImpostor,
            { mass: 0 },
            scn
        );

        return scn;
    }

    function creaOstacolo(indiceCorsia) {
        const xCorrente = giocatore.position.x;
        const larghezza = (0.5 + Math.random() * 1.5) * 1.5;
        const profondità = (0.5 + Math.random() * 1.5) * 1.5;
        const altezza = (0.5 + Math.random() * 1.5) * 1.5;
        const centroY = altezza / 2;
        const moltiplicatoreVel = 0.5 + Math.random();
        const zPos = corsie[indiceCorsia];
        const ostacolo = BABYLON.MeshBuilder.CreateBox("ostacolo", {
            width: larghezza,
            height: altezza,
            depth: profondità
        }, scena);
        ostacolo.position = new BABYLON.Vector3(xCorrente + distanzaSpawn, centroY, zPos);

        if (Math.random() < probabilitaArcobaleno) {
            ostacolo.isRainbow = true;
            ostacolo.hue = Math.random() * 360;
            const [r, g, b] = hsvToRgb(ostacolo.hue, 1, 1);
            const matOst = new BABYLON.StandardMaterial("matOstRainbow", scena);
            matOst.diffuseColor = new BABYLON.Color3(r, g, b);
            ostacolo.material = matOst;
        } else {
            ostacolo.isRainbow = false;
            const matOst = new BABYLON.StandardMaterial("matOst", scena);
            matOst.diffuseColor = new BABYLON.Color3(0, 0, 0);
            ostacolo.material = matOst;
        }

        ostacolo.physicsImpostor = new BABYLON.PhysicsImpostor(
            ostacolo,
            BABYLON.PhysicsImpostor.NoImpostor,
            { mass: 0 },
            scena
        );
        ostacolo._moltiplicatoreVel = moltiplicatoreVel;

        ostacoli.push(ostacolo);
        ultimoSpawnCorsia[indiceCorsia] = giocatore.position.x;
    }

    function spostaSinistra() {
        const corsiaAttuale = corsie.indexOf(obiettivoZ);
        if (corsiaAttuale < corsie.length - 1) {
            obiettivoZ = corsie[corsiaAttuale + 1];
        }
    }

    function spostaDestra() {
        const corsiaAttuale = corsie.indexOf(obiettivoZ);
        if (corsiaAttuale > 0) {
            obiettivoZ = corsie[corsiaAttuale - 1];
        }
    }

    function aggiornaPunteggio() {
        divPunteggio.textContent = "Punteggio: " + punteggio;
    }

    function mostraFine() {
        localStorage.setItem("ultimoPunteggio", punteggio);
        const recordPrecedente = parseInt(localStorage.getItem("punteggioMax") || "0", 10);
        let nuovoRecord = recordPrecedente;
        if (punteggio > recordPrecedente) {
            localStorage.setItem("punteggioMax", punteggio);
            nuovoRecord = punteggio;
        }
        testoFine.innerHTML = `Fine del gioco!<br>Punteggio: ${punteggio}<br>Record: ${nuovoRecord}`;
        divFine.style.display = "block";
    }

    function fineDelGioco() {
        if (!fineGioco) {
            fineGioco = true;
            mostraFine();
        }
    }

    function resettaTutto() {
        ostacoli.forEach(o => o.dispose());
        ostacoli = [];

        segmentiPavimento.forEach(s => {
            s.linee.forEach(l => l.dispose());
            s.mesh.dispose();
        });
        segmentiPavimento = [];

        prossimoInizio = -lunghezzaPavimento;
        ultimoSpawnCorsia[0] = ultimoSpawnCorsia[1] = ultimoSpawnCorsia[2] = -Infinity;

        obiettivoZ = 0;
        if (scena) {
            giocatore.position = new BABYLON.Vector3(0, dimensioneGiocatore / 2, 0);
        }

        punteggio = 0;
        velocitàGioco = velocitàBase;
        accelerazione = 0.5;
        tempoUltimoOstacolo = 0;
        fineGioco = false;
        giocoAvviato = false;
        aggiornaPunteggio();
        divFine.style.display = "none";
        divPunteggio.style.display = "none";
    }

    function avviaGioco() {
        overlayMenu.style.display = "none";
        schoolInfo.style.display = "none";
        yearInfo.style.display = "none";

        canvas.style.display = "block";
        canvas.style.cursor = "none";

        divPunteggio.style.display = "block";
        giocoAvviato = true;

        if (!scena) {
            scena = creaScena();
        }
        motore.runRenderLoop(() => {
            scena.render();
            if (fineGioco) return;

            const dt = motore.getDeltaTime() / 1000;
            ostacoli.forEach((obs) => {
                if (obs.isRainbow) {
                    obs.hue = (obs.hue + 360 * dt) % 360;
                    const [r, g, b] = hsvToRgb(obs.hue, 1, 1);
                    obs.material.diffuseColor = new BABYLON.Color3(r, g, b);
                }
            });

            velocitàGioco += accelerazione * dt;
            giocatore.position.x += velocitàGioco * dt;

            const dz = obiettivoZ - giocatore.position.z;
            if (Math.abs(dz) > 0.01) {
                const passo = Math.sign(dz) * Math.min(Math.abs(dz), velocitàLaterale * dt);
                giocatore.position.z += passo;
            } else {
                giocatore.position.z = obiettivoZ;
            }

            const cam = scena.activeCamera;
            cam.position.x = giocatore.position.x - 12;
            cam.position.y = 6;
            cam.position.z = giocatore.position.z;

            if (giocatore.position.x > prossimoInizio - lunghezzaPavimento * 1.5) {
                const inizio = prossimoInizio;
                const centro = inizio + lunghezzaPavimento / 2;
                const pavimento = BABYLON.MeshBuilder.CreateGround("pavimento", { width: lunghezzaPavimento, height: 12 }, scena);
                pavimento.position = new BABYLON.Vector3(centro, 0, 0);
                const mat = new BABYLON.StandardMaterial("matPavimento", scena);
                mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
                pavimento.material = mat;
                pavimento.physicsImpostor = new BABYLON.PhysicsImpostor(
                    pavimento, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 0 }, scena
                );

                const linee = [];
                corsie.forEach(z => {
                    const linea = BABYLON.MeshBuilder.CreateLines("linea", {
                        points: [
                            new BABYLON.Vector3(inizio, 0.02, z),
                            new BABYLON.Vector3(inizio + lunghezzaPavimento, 0.02, z)
                        ]
                    }, scena);
                    linea.color = new BABYLON.Color3(0, 0, 0);
                    linee.push(linea);
                });
                segmentiPavimento.push({ mesh: pavimento, linee: linee, inizio: inizio });
                prossimoInizio += lunghezzaPavimento;
            }

            for (let i = segmentiPavimento.length - 1; i >= 0; i--) {
                const { mesh, linee, inizio } = segmentiPavimento[i];
                if (inizio + lunghezzaPavimento < giocatore.position.x - lunghezzaPavimento) {
                    linee.forEach(l => l.dispose());
                    mesh.dispose();
                    segmentiPavimento.splice(i, 1);
                }
            }

            for (let i = ostacoli.length - 1; i >= 0; i--) {
                const obs = ostacoli[i];
                const dx = Math.abs(obs.position.x - giocatore.position.x);
                const dzObs = Math.abs(obs.position.z - giocatore.position.z);
                const metà = dimensioneGiocatore / 2;
                if (dx < metà + (obs.scaling ? obs.scaling.x / 2 : 1) &&
                    dzObs < metà + (obs.scaling ? obs.scaling.z / 2 : 1)) {
                    if (obs.isRainbow) {
                        punteggio += 10;
                        aggiornaPunteggio();
                        obs.dispose();
                        ostacoli.splice(i, 1);
                        continue;
                    } else {
                        fineDelGioco();
                    }
                }
                if (obs.position.x < giocatore.position.x - distanzaRimozione) {
                    obs.dispose();
                    ostacoli.splice(i, 1);
                    punteggio++;
                    aggiornaPunteggio();
                }
            }

            tempoUltimoOstacolo += dt;
            const intervalloCorrente = intervalloOstacoli / (1 + (velocitàGioco / 60) * 5);
            if (tempoUltimoOstacolo > intervalloCorrente) {
                const xg = giocatore.position.x;
                const corsieLibere = corsie
                    .map((_, idx) => idx)
                    .filter(idx => xg > ultimoSpawnCorsia[idx] + gapMinimo);
                if (corsieLibere.length > 0) {
                    const scelta = corsieLibere[Math.floor(Math.random() * corsieLibere.length)];
                    creaOstacolo(scelta);
                }
                tempoUltimoOstacolo = 0;
            }
        });
    }

    window.addEventListener("keydown", function(evt) {
        if (!giocoAvviato || fineGioco) return;

        if (evt.code === "KeyA" || evt.code === "ArrowLeft") {
            spostaSinistra();
        }
        if (evt.code === "KeyD" || evt.code === "ArrowRight") {
            spostaDestra();
        }
        if (evt.code === "Escape" && fineGioco) {
            motore.stopRenderLoop();
            if (scena) {
                scena.dispose();
                scena = null;
            }
            resettaTutto();

            canvas.style.display = "none";
            overlayMenu.style.display = "flex";
            schoolInfo.style.display = "block";
            yearInfo.style.display = "block";
        }
    });

    btnGioca.addEventListener("click", function() {
        if (scena) {
            motore.stopRenderLoop();
            scena.dispose();
            scena = null;
        }
        resettaTutto();
        avviaGioco();
    });

    btnClassifica.addEventListener("click", function() {
        const ultimo = localStorage.getItem("ultimoPunteggio") || "0";
        const record = localStorage.getItem("punteggioMax") || "0";
        testoClassifica.innerHTML = `Ultimo punteggio: ${ultimo}<br>Record: ${record}`;
        divClassifica.style.display = "block";
    });

    btnChiudiClassifica.addEventListener("click", function() {
        divClassifica.style.display = "none";
    });

    btnEsci.addEventListener("click", function() {
        window.close();
    });

    btnRiavvia.addEventListener("click", function() {
        if (scena) {
            motore.stopRenderLoop();
            scena.dispose();
            scena = null;
        }
        resettaTutto();
        avviaGioco();
    });

    btnMenu.addEventListener("click", function() {
        if (scena) {
            motore.stopRenderLoop();
            scena.dispose();
            scena = null;
        }
        resettaTutto();

        canvas.style.display = "none";
        overlayMenu.style.display = "flex";
        schoolInfo.style.display = "block";
        yearInfo.style.display = "block";
    });
});