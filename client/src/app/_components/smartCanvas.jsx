'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Layers, Users, ShieldAlert, AlertTriangle } from 'lucide-react';

// --- 1. METAMODEL & CUSTOM NODES ---
const nodeColors = {
  'Objective': '#fef08a', // Yellow
  'SOP': '#bbf7d0',       // Green
  'Software App': '#bfdbfe',// Blue
  'User Role': '#fbcfe8',  // Pink
};

const layers = ['Strategy', 'Process', 'IT', 'IAM'];

// Custom Node to handle visual states (Impact Analysis / Errors)
const EANode = ({ data }) => {
  return (
    <div
      className={`px-4 py-2 shadow-md rounded-md border-2 transition-all duration-300 ${
        data.isImpacted ? 'border-red-500 bg-red-100 animate-pulse' : 'border-gray-800'
      }`}
      style={{ backgroundColor: data.isImpacted ? '#fee2e2' : nodeColors[data.type] || '#fff' }}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <div className="flex flex-col">
        <span className="text-xs font-bold text-gray-500">{data.type}</span>
        <span className="font-semibold text-gray-900">{data.label}</span>
        {data.isImpacted && (
          <span className="text-xs text-red-600 font-bold flex items-center gap-1 mt-1">
            <AlertTriangle size={12} /> Broken Dependency
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </div>
  );
};

const nodeTypes = { eaNode: EANode };

// --- INITIAL STATE ---
const initialNodes = [
  { id: '1', type: 'eaNode', position: { x: 250, y: 50 }, data: { label: 'Increase Q3 Sales', type: 'Objective', layer: 'Strategy' } },
  { id: '2', type: 'eaNode', position: { x: 250, y: 150 }, data: { label: 'Lead Generation SOP', type: 'SOP', layer: 'Process', owner: 'Sales Ops' } },
  { id: '3', type: 'eaNode', position: { x: 250, y: 250 }, data: { label: 'Salesforce', type: 'Software App', layer: 'IT', compliance: 'SOC2' } },
  { id: '4', type: 'eaNode', position: { x: 250, y: 350 }, data: { label: 'Marketing Manager', type: 'User Role', layer: 'IAM' } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3', animated: true },
  { id: 'e3-4', source: '4', target: '3', label: 'HAS_ACCESS_TO', type: 'smoothstep' },
];

// --- MAIN COMPONENT ---
export default function SmartCanvas() {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  const [view, setView] = useState('architect');
  const [selectedNode, setSelectedNode] = useState(null);
  const [flashError, setFlashError] = useState('');

  // --- 2. MULTI-VIEWPORT ENGINE ---
  const visibleNodes = nodes.filter(node => {
    if (view === 'architect') return true;
    if (view === 'hr') return node.data.layer === 'IAM'; // HR only sees IAM/Roles
    if (view === 'secops') return node.data.layer === 'IAM' || node.data.layer === 'IT';
    return true;
  });

  const visibleEdges = edges.filter(edge => {
    // Only show edges where both source and target are currently visible
    const sourceVisible = visibleNodes.some(n => n.id === edge.source);
    const targetVisible = visibleNodes.some(n => n.id === edge.target);
    return sourceVisible && targetVisible;
  });

  // --- 3. SMART EDGE ROUTING & VALIDATION ---
  const onConnect = useCallback((params) => {
    const sourceNode = nodes.find((n) => n.id === params.source);
    const targetNode = nodes.find((n) => n.id === params.target);

    if (!sourceNode || !targetNode) return;

    // Cross-Layer Validation Rule
    if (sourceNode.data.layer === 'Strategy' && targetNode.data.layer === 'IAM') {
      setFlashError('Validation Error: Strategy cannot connect directly to IAM. Must pass through Process.');
      setTimeout(() => setFlashError(''), 3000);
      return;
    }

    // Smart Edge Naming
    let edgeLabel = '';
    if (sourceNode.data.type === 'User Role' && targetNode.data.type === 'Software App') {
      edgeLabel = 'HAS_ACCESS_TO';
    } else if (sourceNode.data.type === 'User Role' && targetNode.data.type === 'User Role') {
      edgeLabel = 'REPORTS_TO';
    }

    const newEdge = { ...params, label: edgeLabel, type: 'smoothstep' };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [nodes, setEdges]);

  // --- 4. IMPACT ANALYSIS SIMULATION ---
  const onNodesDelete = useCallback((deletedNodes) => {
    const deletedIds = deletedNodes.map(n => n.id);
    
    // Find processes that relied on the deleted IT apps
    const impactedProcessIds = edges
      .filter(e => deletedIds.includes(e.target)) // If target (App) is deleted
      .map(e => e.source);

    if (impactedProcessIds.length > 0) {
      setNodes((nds) => 
        nds.map((node) => {
          if (impactedProcessIds.includes(node.id) && node.data.layer === 'Process') {
            return { ...node, data: { ...node.data, isImpacted: true } };
          }
          return node;
        })
      );
    }
  }, [edges, setNodes]);

  // --- DRAG AND DROP HANDLERS ---
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow/type');
    const layer = event.dataTransfer.getData('application/reactflow/layer');
    if (!type) return;

    const position = { x: event.clientX - 250, y: event.clientY - 100 }; // rough offset for sidebar
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'eaNode',
      position,
      data: { label: `New ${type}`, type, layer },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  return (
    <div className="flex h-screen w-full bg-gray-50 text-gray-900 font-sans">
      
      {/* LEFT SIDEBAR: Palette & Viewport Control */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-6 z-10">
        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Layers size={20} /> Viewpoint
          </h2>
          <select 
            className="w-full p-2 border rounded-md bg-gray-50"
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="architect">Architect View (Full Map)</option>
            <option value="hr">HR View (Org Chart)</option>
            <option value="secops">IT SecOps (IAM Only)</option>
          </select>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">Metamodel Palette</h2>
          <p className="text-xs text-gray-500 mb-2">Drag elements onto the canvas</p>
          <div className="flex flex-col gap-2">
            {[
              { type: 'Objective', layer: 'Strategy', color: 'bg-yellow-200' },
              { type: 'SOP', layer: 'Process', color: 'bg-green-200' },
              { type: 'Software App', layer: 'IT', color: 'bg-blue-200' },
              { type: 'User Role', layer: 'IAM', color: 'bg-pink-200' }
            ].map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow/type', item.type);
                  e.dataTransfer.setData('application/reactflow/layer', item.layer);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className={`${item.color} p-3 rounded-md border border-gray-300 cursor-grab hover:shadow-md transition-shadow`}
              >
                {item.type} ({item.layer})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER: Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        {/* Flash Error Overlay */}
        {flashError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-md shadow-lg flex items-center gap-2 animate-bounce">
            <ShieldAlert size={20} /> {flashError}
          </div>
        )}

        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={(_, node) => setSelectedNode(node)}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#ccc" gap={16} />
          <Controls />
        </ReactFlow>
      </div>

      {/* RIGHT SIDEBAR: Context Panel */}
      <div className="w-72 bg-white border-l border-gray-200 p-4 overflow-y-auto z-10">
        <h2 className="text-lg font-bold mb-4">Context Panel</h2>
        {selectedNode ? (
          <div className="flex flex-col gap-3">
            <div className="p-3 bg-gray-100 rounded-md">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Node Name</span>
              <p className="font-semibold text-lg">{selectedNode.data.label}</p>
            </div>
            
            <div className="p-3 border border-gray-200 rounded-md flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Type</span>
                <span className="text-sm font-medium">{selectedNode.data.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Layer</span>
                <span className="text-sm font-medium">{selectedNode.data.layer}</span>
              </div>
              {selectedNode.data.owner && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Owner</span>
                  <span className="text-sm font-medium">{selectedNode.data.owner}</span>
                </div>
              )}
              {selectedNode.data.compliance && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Compliance</span>
                  <span className="text-sm font-medium text-green-700">{selectedNode.data.compliance}</span>
                </div>
              )}
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-2">JSON Representation</h3>
              <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded-md overflow-x-auto">
                {JSON.stringify(selectedNode.data, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic flex flex-col items-center gap-2 mt-10">
            <Users size={32} className="text-gray-300" />
            Click any node or edge to inspect metadata.
          </p>
        )}
      </div>
    </div>
  );
}