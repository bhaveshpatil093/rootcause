'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

type Node = { id: string; name: string; val: number; color?: string };
type Link = { source: string; target: string };

export default function RepoStructureGraph({ url }: { url: string }) {
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 400 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: 400
      });
    }
    
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: 400
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [graphData]); // Re-measure when data loads and container appears

  useEffect(() => {
    async function fetchTree() {
      if (!url) return;
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) return;
      
      const [, owner, repoRaw] = match;
      const repo = repoRaw.replace('.git', '');

      try {
        setLoading(true);
        setError(null);
        
        // 1. Get default branch
        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (!repoRes.ok) throw new Error('Failed to fetch repo details');
        const repoData = await repoRes.ok ? await repoRes.json() : null;
        const defaultBranch = repoData?.default_branch || 'main';

        // 2. Fetch tree
        const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);
        if (!treeRes.ok) throw new Error('Failed to fetch repository tree');
        
        const treeData = await treeRes.json();
        
        const nodes: Node[] = [{ id: 'root', name: repo, val: 20, color: '#f59e0b' }]; // Amber for root
        const links: Link[] = [];

        // Truncate to avoid crashing browser with massive repos (max 500 items for visualization)
        const items = treeData.tree.slice(0, 500);

        const pathSet = new Set<string>(['root']);

        items.forEach((item: any) => {
          pathSet.add(item.path);
          const isDir = item.type === 'tree';
          const name = item.path.split('/').pop() || item.path;
          
          let color = '#9ca3af';
          let val = 3;
          if (isDir) {
            color = '#60a5fa'; // Blue
            val = 6;
          } else if (name.match(/\.(ts|tsx|js|jsx)$/)) {
            color = '#a78bfa'; // Purple
            val = 4;
          } else if (name.match(/\.(md|json|yml|yaml)$/)) {
            color = '#34d399'; // Emerald
            val = 4;
          }

          nodes.push({
            id: item.path,
            name: name,
            val: val,
            color: color
          });

          // Link to parent
          const parts = item.path.split('/');
          parts.pop(); // remove self
          const parentPath = parts.length > 0 ? parts.join('/') : 'root';
          
          links.push({
            source: parentPath,
            target: item.path
          });
        });

        // Ensure all parent paths actually exist in the nodes list (some might be missing if we truncated)
        const validLinks = links.filter(l => pathSet.has(l.source) && pathSet.has(l.target));

        setGraphData({ nodes, links: validLinks });
      } catch (err: any) {
        console.error(err);
        setError('Could not load repository graph structure. (May be too large or rate limited)');
      } finally {
        setLoading(false);
      }
    }

    fetchTree();
  }, [url]);

  if (!url) return null;

  return (
    <div className="mt-6">
      <h2 className="font-mono text-xs tracking-widest text-[var(--muted)] mb-3 uppercase">
        Repository Structure Graph
      </h2>
      <div 
        ref={containerRef}
        className="w-full relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex items-center justify-center min-h-[400px]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#60a5fa]/5 to-transparent pointer-events-none" />
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-mono text-sm text-[var(--muted)] animate-pulse">Mapping directory tree...</span>
          </div>
        )}
        
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-mono text-sm text-[var(--red)] px-4 text-center">{error}</span>
          </div>
        )}

        {!loading && graphData && (
          <div className="w-full h-full transition-opacity duration-1000 opacity-100">
            <ForceGraph2D
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              nodeRelSize={4}
              linkColor={() => 'rgba(255, 255, 255, 0.15)'}
              linkWidth={1}
              linkDirectionalParticles={2}
              linkDirectionalParticleWidth={1.5}
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleColor={() => 'rgba(96, 165, 250, 0.8)'}
              backgroundColor="transparent"
              enableZoomInteraction={true}
              enablePanInteraction={true}
              enablePointerInteraction={true}
              cooldownTicks={100}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const label = node.name;
                const fontSize = 12 / globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                
                // Draw circle with glow
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
                ctx.fillStyle = node.color || '#9ca3af';
                ctx.shadowColor = node.color || '#9ca3af';
                ctx.shadowBlur = 10;
                ctx.fill();
                
                // Draw label if zoomed in enough or if it's a directory/root
                if (globalScale > 1.5 || node.val > 5) {
                  ctx.shadowBlur = 0; // reset shadow for crisp text
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                  ctx.fillText(label, node.x, node.y + node.val + (fontSize * 1.2));
                }
                
                // Reset shadow for next operations
                ctx.shadowBlur = 0;
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
