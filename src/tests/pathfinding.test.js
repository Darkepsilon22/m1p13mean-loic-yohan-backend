/**
 * Tests unitaires pour le pathfinding (algorithme de Dijkstra)
 * 
 * Ces tests vérifient que l'algorithme de plus court chemin fonctionne correctement
 * sur un graphe de test simple.
 */

const dijkstra = require('../controllers/mapController').dijkstra || (() => {
  // Copie de l'algorithme pour les tests
  function dijkstra(graph, startNodeId, endNodeId) {
    const distances = {};
    const previous = {};
    const unvisited = new Set();
    
    for (const nodeId in graph) {
      distances[nodeId] = Infinity;
      previous[nodeId] = null;
      unvisited.add(nodeId);
    }
    distances[startNodeId] = 0;
    
    while (unvisited.size > 0) {
      let currentNodeId = null;
      let minDist = Infinity;
      for (const nodeId of unvisited) {
        if (distances[nodeId] < minDist) {
          minDist = distances[nodeId];
          currentNodeId = nodeId;
        }
      }
      
      if (currentNodeId === null || distances[currentNodeId] === Infinity) {
        break;
      }
      
      unvisited.delete(currentNodeId);
      
      if (currentNodeId === endNodeId) {
        const path = [];
        let nodeId = endNodeId;
        while (nodeId !== null) {
          path.unshift(nodeId);
          nodeId = previous[nodeId];
        }
        return { path, cost: distances[endNodeId] };
      }
      
      const neighbors = graph[currentNodeId] || {};
      for (const neighborId in neighbors) {
        if (unvisited.has(neighborId)) {
          const alt = distances[currentNodeId] + neighbors[neighborId];
          if (alt < distances[neighborId]) {
            distances[neighborId] = alt;
            previous[neighborId] = currentNodeId;
          }
        }
      }
    }
    
    return null;
  }
  return dijkstra;
})();

describe('Pathfinding - Dijkstra', () => {
  test('Graphe simple : chemin direct A -> B', () => {
    const graph = {
      A: { B: 5 },
      B: {}
    };
    const result = dijkstra(graph, 'A', 'B');
    expect(result).not.toBeNull();
    expect(result.path).toEqual(['A', 'B']);
    expect(result.cost).toBe(5);
  });

  test('Graphe avec plusieurs chemins : choisir le plus court', () => {
    const graph = {
      A: { B: 10, C: 3 },
      B: { D: 5 },
      C: { D: 2 },
      D: {}
    };
    const result = dijkstra(graph, 'A', 'D');
    expect(result).not.toBeNull();
    expect(result.path).toEqual(['A', 'C', 'D']); // A->C->D = 5, plus court que A->B->D = 15
    expect(result.cost).toBe(5);
  });

  test('Graphe bidirectionnel', () => {
    const graph = {
      A: { B: 5 },
      B: { A: 5, C: 3 },
      C: { B: 3 }
    };
    const result = dijkstra(graph, 'A', 'C');
    expect(result).not.toBeNull();
    expect(result.path).toEqual(['A', 'B', 'C']);
    expect(result.cost).toBe(8);
  });

  test('Pas de chemin possible', () => {
    const graph = {
      A: { B: 5 },
      B: {},
      C: { D: 3 },
      D: {}
    };
    const result = dijkstra(graph, 'A', 'C');
    expect(result).toBeNull();
  });

  test('Graphe avec boucle : éviter les cycles', () => {
    const graph = {
      A: { B: 2 },
      B: { C: 3, A: 2 },
      C: { D: 1 },
      D: {}
    };
    const result = dijkstra(graph, 'A', 'D');
    expect(result).not.toBeNull();
    expect(result.path).toEqual(['A', 'B', 'C', 'D']);
    expect(result.cost).toBe(6);
  });
});

// Note: Pour exécuter ces tests, utiliser Jest ou un autre framework de test Node.js
// Exemple: npm install --save-dev jest && npm test
