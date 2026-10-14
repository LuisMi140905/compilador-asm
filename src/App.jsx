import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Play, Plus, Trash2, Cpu, FileCode, Download, GitBranch } from 'lucide-react';

const ASM_Compiler = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Mapa dinámico de variables (autogenerado y auto-numerado)
  const [varMap, setVarMap] = useState({ 'w': 0, 'x': 1, 'y': 2, 'z': 3 });
  
  const [estados, setEstados] = useState([
    { id: 'E0', testVar: 'y', nextFalse: 'E1', nextTrue: 'E3', outputs: '00011' },
    { id: 'E1', testVar: 'z', nextFalse: 'E4', nextTrue: 'E2', outputs: '10010' },
    { id: 'E2', testVar: 'y', nextFalse: 'E2', nextTrue: 'E3', outputs: '00100' },
    { id: 'E3', testVar: 'x', nextFalse: 'E4', nextTrue: 'E0', outputs: '01100' },
    { id: 'E4', testVar: 'w', nextFalse: 'E0', nextTrue: 'E0', outputs: '01010' },
  ]);

  const [hexOutput, setHexOutput] = useState({ hex1: '', hex2: '' });
  const [mermaidSvg, setMermaidSvg] = useState('');

  // Cálculo dinámico de anchos de bit (mínimo 3 bits: 000-111)
  const stateBits = Math.max(3, Math.ceil(Math.log2(estados.length || 1)));
  const varBits = Math.max(3, Math.ceil(Math.log2(Object.keys(varMap).length || 1)));

  const handleVarChange = (index, newVar) => {
    const newEstados = [...estados];
    const val = newVar.toLowerCase().trim();
    newEstados[index].testVar = val;

    // Autoregistrar nueva variable si no existe en el sistema
    if (val !== '' && varMap[val] === undefined) {
      setVarMap(prev => ({ ...prev, [val]: Object.keys(prev).length }));
    }
    setEstados(newEstados);
  };

  const addEstado = () => {
    setEstados([...estados, { 
      id: `E${estados.length}`, 
      testVar: 'w', 
      nextFalse: 'E0', 
      nextTrue: 'E0', 
      outputs: '00000' 
    }]);
  };

  const eliminarEstado = (index) => {
    if (estados.length <= 1) return;
    const nuevosEstados = [...estados];
    nuevosEstados.splice(index, 1);
    setEstados(nuevosEstados);
  };

  const compilarHex = () => {
    let strHex1 = '';
    let strHex2 = '';

    estados.forEach((estado) => {
      // 1. Obtener valores binarios formateados a la longitud dinámica
      const testValDec = varMap[estado.testVar] !== undefined ? varMap[estado.testVar] : 0;
      const testBin = testValDec.toString(2).padStart(varBits, '0');
      
      const falseIdx = Math.max(0, estados.findIndex(e => e.id === estado.nextFalse));
      const falseBin = falseIdx.toString(2).padStart(stateBits, '0');
      
      const trueIdx = Math.max(0, estados.findIndex(e => e.id === estado.nextTrue));
      const trueBin = trueIdx.toString(2).padStart(stateBits, '0');

      // 2. Empaquetar HEX1: [Prueba] + [Liga Falsa] + [Liga Verdadera]
      const controlBin = testBin + falseBin + trueBin;
      const padLen = Math.ceil(controlBin.length / 4) * 4; 
      const hex1Dec = parseInt(controlBin.padStart(padLen, '0'), 2);
      strHex1 += hex1Dec.toString(16).padStart(padLen / 4, '0').toUpperCase() + ' ';

      // 3. Empaquetar HEX2: [Salidas]
      const outBin = estado.outputs;
      const outPadLen = Math.ceil(outBin.length / 4) * 4;
      const hex2Dec = parseInt(outBin.padStart(outPadLen, '0'), 2) || 0;
      strHex2 += hex2Dec.toString(16).padStart(outPadLen / 4, '0').toUpperCase() + ' ';
    });

    setHexOutput({ hex1: strHex1.trim(), hex2: strHex2.trim() });
    renderGraph();
  };

  const descargarArchivo = (nombre, contenido) => {
    const blob = new Blob([contenido], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getArduinoCode = () => {
    const varsCount = Object.keys(varMap).length;
    return `// Compilador ASM - Direccionamiento Entrada-Estado
#include <ESP_PLD.h>

// ENTRADAS (Configuradas: ${varsCount} variables de prueba)
#define I0 E0   // Bit 0 de Prueba
#define I1 E1   // Bit 1 de Prueba
${varBits > 2 ? '#define I2 E2   // Bit 2 de Prueba\n' : ''}
// Variables declaradas en la carta: ${Object.keys(varMap).join(', ')}

#define LV0 E5  // Liga Verdadera 0
#define LV1 E6  // Liga Verdadera 1
#define LV2 E7  // Liga Verdadera 2
#define LF0 E8  // Liga Falsa 0
#define LF1 E9  // Liga Falsa 1
#define LF2 E10 // Liga Falsa 2
#define clk E11

// SALIDAS
#define L2 S3
#define L1 S4
#define L0 S5

short sl=0;

void setup() {
  pld_ini(); 
}

void loop() {
  // Selector de Liga Dinámico (Generar ecuaciones según vars registradas)
  // Reemplaza esto con tu MUX basado en las variables ${Object.keys(varMap).join(', ')}
  // sl = ...
  
  // Ruteo MUX directo de Memoria -> Salida
  digitalWrite(L2, !sl&LF2 | sl&LV2);
  digitalWrite(L1, !sl&LF1 | sl&LV1);
  digitalWrite(L0, !sl&LF0 | sl&LV0);
}`;
  };

  const renderGraph = async () => {
    if (!window.mermaid) return;
    
    window.mermaid.initialize({ 
        startOnLoad: false, 
        theme: isDarkMode ? 'dark' : 'default',
        flowchart: { curve: 'stepBefore' }
    });

    let graphDef = `graph TD\n`;
    estados.forEach((e, i) => {
      const binActual = i.toString(2).padStart(stateBits, '0');
      graphDef += `${e.id}["<b>${e.id}</b> (${binActual})<br/>Salidas: ${e.outputs}"]\n`;
      
      const varTestLower = e.testVar.trim().toLowerCase();
      
      // Magia: Ignorar rombo si la variable es comodín 'w'
      if (varTestLower === 'w') {
          if(e.nextTrue) graphDef += `${e.id} --> ${e.nextTrue}\n`;
      } else {
          const condId = `C_${e.id}`;
          graphDef += `${e.id} --> ${condId}{"${e.testVar}"}\n`;
          if(e.nextFalse) graphDef += `${condId} -- 0 --> ${e.nextFalse}\n`;
          if(e.nextTrue) graphDef += `${condId} -- 1 --> ${e.nextTrue}\n`;
          
          if (isDarkMode) {
              graphDef += `style ${condId} fill:#1f2937,stroke:#9ca3af,stroke-width:2px,color:#fff\n`;
          } else {
              graphDef += `style ${condId} fill:#ffffff,stroke:#94a3b8,stroke-width:2px\n`;
          }
      }
      
      if (isDarkMode) {
          graphDef += `style ${e.id} fill:#374151,stroke:#9ca3af,stroke-width:2px,rx:4,ry:4,color:#fff\n`;
      } else {
          graphDef += `style ${e.id} fill:#f8fafc,stroke:#cbd5e1,stroke-width:2px,rx:4,ry:4\n`;
      }
    });

    try {
      const { svg } = await window.mermaid.render('asmDiagram_' + Date.now(), graphDef);
      setMermaidSvg(svg);
    } catch (error) { console.error("Mermaid error:", error); }
  };

  useEffect(() => {
    const loadMermaid = () => {
      if (!window.mermaid) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
        script.async = true;
        script.onload = () => { renderGraph(); };
        document.body.appendChild(script);
      } else { renderGraph(); }
    };
    loadMermaid();
  }, [isDarkMode, estados.length]); 

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300 font-sans p-4 md:p-6">
        <div className="max-w-[1400px] mx-auto space-y-6">
          
          {/* Header */}
          <header className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                <Cpu className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Compilador ASM Dinámico</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Método: <strong className="text-indigo-600 dark:text-indigo-400">Entrada-Estado</strong></p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button onClick={compilarHex} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95">
                <Play className="w-5 h-5" /> Compilar Sistema
              </button>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
                title="Alternar Modo Oscuro"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            
            {/* Editor de Tabla Dinámica */}
            <div className="xl:col-span-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col transition-colors">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-indigo-500" /> Editor Lógico ({stateBits} bits/estado | {varBits} bits/variable)
                </h2>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold text-[11px] rounded-lg">
                    <tr>
                      <th className="p-3 rounded-l-lg">Estado</th>
                      <th className="p-3 text-slate-400">Bin (Auto)</th>
                      <th className="p-3">Variable</th>
                      <th className="p-3 text-slate-400">Prueba (Auto)</th>
                      <th className="p-3 text-rose-600 dark:text-rose-400">Liga Falsa (0)</th>
                      <th className="p-3 text-emerald-600 dark:text-emerald-400">Liga Verd. (1)</th>
                      <th className="p-3 text-orange-600 dark:text-orange-400">Salidas</th>
                      <th className="p-3 rounded-r-lg text-center">X</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {estados.map((est, idx) => {
                      const binEstado = idx.toString(2).padStart(stateBits, '0');
                      const varActual = varMap[est.testVar];
                      const binVar = (varActual !== undefined ? varActual : 0).toString(2).padStart(varBits, '0');
                      
                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="p-2"><input className="w-12 p-2 bg-transparent dark:text-white font-bold outline-none border-b-2 border-transparent focus:border-indigo-500 transition-colors" value={est.id} onChange={e => { const n = [...estados]; n[idx].id = e.target.value; setEstados(n); }}/></td>
                          <td className="p-2 text-indigo-400 font-mono font-bold">{binEstado}</td>
                          <td className="p-2"><input className="w-12 p-2 bg-transparent dark:text-white font-semibold outline-none border-b-2 border-transparent focus:border-indigo-500 transition-colors" value={est.testVar} onChange={e => handleVarChange(idx, e.target.value)}/></td>
                          <td className="p-2 text-emerald-400 font-mono">{binVar}</td>
                          <td className="p-2"><input className="w-14 p-2 bg-transparent dark:text-white font-bold text-rose-600 dark:text-rose-400 outline-none border-b-2 border-transparent focus:border-rose-500 transition-colors" value={est.nextFalse} onChange={e => { const n = [...estados]; n[idx].nextFalse = e.target.value; setEstados(n); }}/></td>
                          <td className="p-2"><input className="w-14 p-2 bg-transparent dark:text-white font-bold text-emerald-600 dark:text-emerald-400 outline-none border-b-2 border-transparent focus:border-emerald-500 transition-colors" value={est.nextTrue} onChange={e => { const n = [...estados]; n[idx].nextTrue = e.target.value; setEstados(n); }}/></td>
                          <td className="p-2"><input className="w-20 p-2 bg-transparent dark:text-white font-mono text-orange-600 dark:text-orange-400 outline-none border-b-2 border-transparent focus:border-orange-500 transition-colors" value={est.outputs} onChange={e => { const n = [...estados]; n[idx].outputs = e.target.value; setEstados(n); }}/></td>
                          <td className="p-2 text-center">
                            <button onClick={() => eliminarEstado(idx)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <button onClick={addEstado} className="mt-4 flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-4 py-2 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Añadir Estado
                </button>
              </div>
            </div>

            {/* Grafo Mermaid */}
            <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col transition-colors overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 dark:text-white">Mapa ASM Renderizado</h2>
              </div>
              <div className="flex-1 p-4 bg-slate-50/50 dark:bg-slate-900/50 overflow-auto flex justify-center items-start min-h-[300px]">
                {mermaidSvg ? (
                  <div dangerouslySetInnerHTML={{ __html: mermaidSvg }} className="max-w-full" />
                ) : (
                  <div className="text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center h-full gap-2">
                    <Cpu className="w-10 h-10 opacity-50" />
                    <p className="text-sm font-medium">Presiona Compilar para renderizar el diagrama</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Exportación HEX y Arduino */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            <div className="bg-slate-900 dark:bg-black rounded-2xl shadow-lg border border-slate-800 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 flex items-center gap-2 bg-slate-800/50">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white">Memoria (Para BK Precision)</h3>
              </div>
              <div className="p-5 font-mono text-sm space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-slate-400 font-bold tracking-wider text-[10px] uppercase">
                      Dir. 0x0000 | [Prueba][L.Falsa][L.Verd.]
                    </div>
                    <button onClick={() => descargarArchivo('HEX1_Ligas.txt', hexOutput.hex1)} disabled={!hexOutput.hex1} className="text-xs flex items-center gap-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-2 py-1 rounded transition-colors disabled:opacity-50">
                      <Download className="w-3 h-3"/> Descargar .TXT
                    </button>
                  </div>
                  <div className="bg-black/50 p-3 rounded-lg border border-slate-800 text-emerald-400 font-bold tracking-widest break-all shadow-inner select-all min-h-[44px]">
                    {hexOutput.hex1 ? `${hexOutput.hex1} FF FF FF ...` : ''}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-slate-400 font-bold tracking-wider text-[10px] uppercase">
                      Dir. 0x0010 | Salidas [S(n)...S0]
                    </div>
                    <button onClick={() => descargarArchivo('HEX2_Salidas.txt', hexOutput.hex2)} disabled={!hexOutput.hex2} className="text-xs flex items-center gap-1 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 px-2 py-1 rounded transition-colors disabled:opacity-50">
                      <Download className="w-3 h-3"/> Descargar .TXT
                    </button>
                  </div>
                  <div className="bg-black/50 p-3 rounded-lg border border-slate-800 text-orange-400 font-bold tracking-widest break-all shadow-inner select-all min-h-[44px]">
                    {hexOutput.hex2 ? `${hexOutput.hex2} FF FF FF ...` : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#1e1e1e] rounded-2xl shadow-lg border border-slate-800 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#252526]">
                <div className="flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-white">Arduino ESP32 (.ino)</h3>
                </div>
                <button onClick={() => descargarArchivo('ESP32_ASM.ino', getArduinoCode())} className="text-xs flex items-center gap-1 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 px-3 py-1.5 rounded transition-colors">
                  <Download className="w-3 h-3"/> Descargar .INO
                </button>
              </div>
              <div className="p-5 font-mono text-xs md:text-sm text-indigo-300 overflow-auto bg-[#1e1e1e] shadow-inner select-all h-[240px]">
<pre>{getArduinoCode()}</pre>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default ASM_Compiler;