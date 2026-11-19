(() => {
  'use strict';

  const width = 1050;
  const height = 700;
  const tau = 2 * Math.PI;
  const clusterAspect = 1.42;

  function randomSource() {
    let state = 731392621;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function collectGraph(terms, titleOf, resolveId) {
    const nodes = [];
    const index = new Map();
    for (const term of terms) {
      if (!term?.id || index.has(term.id)) continue;
      index.set(term.id, nodes.length);
      nodes.push({id: term.id, title: titleOf(term), x: 0, y: 0, degree: 0, group: -1});
    }

    const adjacent = nodes.map(() => new Map());
    const edges = [];
    for (const term of terms) {
      if (!index.has(term?.id)) continue;
      const source = index.get(term.id);
      for (const link of term.links || []) {
        const id = typeof link === 'string' ? link : link?.target || link?.id;
        if (!id) continue;
        const target = index.get(id) ?? index.get(resolveId?.(id));
        if (target === undefined || source === target || adjacent[source].has(target)) continue;
        adjacent[source].set(target, 1);
        adjacent[target].set(source, 1);
        edges.push(source < target ? [source, target] : [target, source]);
      }
    }
    nodes.forEach((node, i) => { node.degree = adjacent[i].size; });
    return {nodes, edges, adjacent, index};
  }

  function partition(adjacent, degrees, total, random) {
    const membership = degrees.map((_, i) => i);
    const volumes = [...degrees];
    const order = degrees.map((_, i) => i).filter(i => degrees[i] > 0);
    for (let pass = 0; pass < 16; pass++) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      let changes = 0;
      for (const vertex of order) {
        const current = membership[vertex];
        const degree = degrees[vertex];
        const weights = new Map();
        for (const [neighbor, weight] of adjacent[vertex]) {
          const group = membership[neighbor];
          weights.set(group, (weights.get(group) || 0) + weight);
        }
        volumes[current] -= degree;
        const expected = 1.28 * degree / total;
        let best = current;
        let bestScore = (weights.get(current) || 0) - expected * volumes[current];
        for (const [candidate, weight] of weights) {
          const score = weight - expected * volumes[candidate];
          if (score > bestScore + 1e-9) {
            best = candidate;
            bestScore = score;
          }
        }
        membership[vertex] = best;
        volumes[best] += degree;
        if (best !== current) changes++;
      }
      if (!changes) break;
    }
    return membership;
  }

  function communitiesFor(adjacent, nodes, random) {
    let degrees = nodes.map(node => node.degree);
    let membership = nodes.map((_, i) => i);
    const total = degrees.reduce((sum, degree) => sum + degree, 0);
    for (let level = 0; total && level < 6; level++) {
      const partitioned = partition(adjacent, degrees, total, random);
      const groups = new Map();
      const reduced = partitioned.map(group => {
        if (!groups.has(group)) groups.set(group, groups.size);
        return groups.get(group);
      });
      if (groups.size === adjacent.length) break;
      membership = membership.map(group => reduced[group]);
      const nextDegrees = new Array(groups.size).fill(0);
      const nextAdjacent = nextDegrees.map(() => new Map());
      for (const [vertex, links] of adjacent.entries()) {
        const group = reduced[vertex];
        nextDegrees[group] += degrees[vertex];
        for (const [neighbor, weight] of links) {
          const target = reduced[neighbor];
          if (target !== group) {
            nextAdjacent[group].set(target, (nextAdjacent[group].get(target) || 0) + weight);
          }
        }
      }
      adjacent = nextAdjacent;
      degrees = nextDegrees;
    }

    const clustered = new Map();
    for (const [i, group] of membership.entries()) {
      if (!nodes[i].degree) continue;
      if (!clustered.has(group)) clustered.set(group, []);
      clustered.get(group).push(i);
    }
    return [...clustered.values()].sort((a, b) => b.length - a.length);
  }

  function buildClusters(communities, nodes, edges, random) {
    const clusters = communities.map((members, id) => {
      const angle = tau * random();
      const distance = 170 * Math.sqrt(random());
      const radius = 7.7 * Math.sqrt(members.length) + 6;
      for (const i of members) nodes[i].group = id;
      return {
        id, members, radius, x: distance * Math.cos(angle), y: distance * Math.sin(angle),
        internal: [], links: new Map(),
      };
    });
    for (const [a, b] of edges) {
      const source = clusters[nodes[a].group];
      const target = clusters[nodes[b].group];
      if (source === target) {
        source.internal.push([a, b]);
      } else {
        source.links.set(target.id, (source.links.get(target.id) || 0) + 1);
        target.links.set(source.id, (target.links.get(source.id) || 0) + 1);
      }
    }
    return clusters;
  }

  function positionClusters(clusters) {
    for (let step = 0; step < 220; step++) {
      for (const [i, a] of clusters.entries()) {
        a.x *= 0.997;
        a.y *= 0.997;
        for (let j = i + 1; j < clusters.length; j++) {
          const b = clusters[j];
          const dx = b.x - a.x || 0.0001;
          const dy = (b.y - a.y) * clusterAspect;
          const distance = Math.hypot(dx, dy);
          const clearance = a.radius + b.radius + 15;
          const weight = a.links.get(j) || 0;
          const attraction = 0.0045 * Math.log1p(weight) * Math.max(0, distance - clearance);
          const repulsion = 0.25 * Math.max(0, clearance - distance);
          const force = (attraction - repulsion) / distance;
          const share = b.radius / (a.radius + b.radius);
          a.x += dx * force * share;
          a.y += dy * force * share / clusterAspect;
          b.x -= dx * force * (1 - share);
          b.y -= dy * force * (1 - share) / clusterAspect;
        }
      }
      for (const cluster of clusters) {
        const rx = Math.max(40, width / 2 - cluster.radius - 16);
        const ry = Math.max(40, height / 2 - cluster.radius / clusterAspect - 18);
        const limit = Math.hypot(cluster.x / rx, cluster.y / ry);
        if (limit > 1) {
          cluster.x /= limit;
          cluster.y /= limit;
        }
      }
    }
  }

  function positionMembers(cluster, clusters, nodes, adjacent, random, spread) {
    const profile = 0.84 + random() * 0.34;
    const tilt = (random() - 0.5) * 1.55;
    const rx = cluster.radius * profile;
    const ry = cluster.radius / (clusterAspect * profile);
    const anchors = cluster.members.map(i => {
      const angle = tau * random();
      const distance = Math.sqrt(random()) * 0.87;
      const node = nodes[i];
      node.x = rx * distance * Math.cos(angle);
      node.y = ry * distance * Math.sin(angle);
      let x = 0;
      let y = 0;
      let external = 0;
      for (const neighbor of adjacent[i].keys()) {
        const other = clusters[nodes[neighbor].group];
        if (other === cluster) continue;
        const dx = other.x - cluster.x;
        const dy = other.y - cluster.y;
        const length = Math.hypot(dx, dy) || 1;
        x += dx / length;
        y += dy / length;
        external++;
      }
      return external ? [x / external * rx * 0.67, y / external * ry * 0.67] : [0, 0];
    });
    const members = cluster.members.map(i => nodes[i]);
    const separation = members.map(node => 4.1 + 0.48 * Math.sqrt(node.degree));
    for (let step = 0; step < 68; step++) {
      for (const [a, b] of cluster.internal) {
        const source = nodes[a];
        const target = nodes[b];
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.hypot(dx, dy) || 1;
        const rest = 12 + Math.sqrt(source.degree + target.degree) * 2.2;
        const force = (distance - rest) / distance * 0.035;
        source.x += dx * force;
        source.y += dy * force;
        target.x -= dx * force;
        target.y -= dy * force;
      }
      for (const [i, a] of members.entries()) {
        a.x += (anchors[i][0] - a.x) * 0.009;
        a.y += (anchors[i][1] - a.y) * 0.009;
        for (let j = i + 1; j < members.length; j++) {
          const b = members[j];
          const minimum = separation[i] + separation[j];
          const dx = b.x - a.x || 0.0001;
          const dy = b.y - a.y;
          const squared = dx * dx + dy * dy;
          if (squared >= minimum * minimum) continue;
          const distance = Math.sqrt(squared);
          const force = (minimum / distance - 1) * 0.31;
          a.x -= dx * force;
          a.y -= dy * force;
          b.x += dx * force;
          b.y += dy * force;
        }
        const limit = Math.hypot(a.x / rx, a.y / ry);
        if (limit > 1) {
          a.x /= limit;
          a.y /= limit;
        }
      }
    }
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    for (const node of members) {
      const x = cluster.x + cos * node.x - sin * node.y;
      const y = cluster.y + sin * node.x + cos * node.y;
      node.x = width / 2 + x * spread.x;
      node.y = height / 2 + y * spread.y;
    }
  }

  function positionIsolates(nodes, random) {
    const positioned = nodes.filter(node => node.degree);
    for (const node of nodes) {
      if (node.degree) continue;
      let best = -Infinity;
      for (let attempt = 0; attempt < 24; attempt++) {
        const angle = tau * random();
        const distance = Math.sqrt(random());
        const x = width / 2 + (width / 2 - 40) * distance * Math.cos(angle);
        const y = height / 2 + (height / 2 - 32) * distance * Math.sin(angle);
        let gap = 20 * 20;
        for (const other of positioned) {
          if (Math.abs(x - other.x) > 20 || Math.abs(y - other.y) > 20) continue;
          gap = Math.min(gap, (x - other.x) ** 2 + (y - other.y) ** 2);
        }
        if (gap > best) {
          [node.x, node.y] = [x, y];
          best = gap;
        }
        if (gap >= 19 * 19) break;
      }
      positioned.push(node);
    }
  }

  function separateNodes(nodes) {
    const cellSize = 16;
    const columns = Math.ceil(width / cellSize);
    const margin = 12;
    const radii = nodes.map(node => Math.min(7.5, 4.2 + 0.4 * Math.sqrt(node.degree)));
    for (let step = 0; step < 18; step++) {
      const cells = new Map();
      for (const [i, node] of nodes.entries()) {
        const x = Math.floor(node.x / cellSize);
        const y = Math.floor(node.y / cellSize);
        const cell = y * columns + x;
        if (!cells.has(cell)) cells.set(cell, []);
        cells.get(cell).push(i);
      }
      for (const [i, a] of nodes.entries()) {
        const x = Math.floor(a.x / cellSize);
        const y = Math.floor(a.y / cellSize);
        for (let row = y - 1; row <= y + 1; row++) {
          for (let column = x - 1; column <= x + 1; column++) {
            for (const j of cells.get(row * columns + column) || []) {
              if (j <= i) continue;
              const b = nodes[j];
              const minimum = radii[i] + radii[j];
              const dx = b.x - a.x || 0.0001;
              const dy = b.y - a.y;
              const squared = dx * dx + dy * dy;
              if (squared >= minimum * minimum) continue;
              const force = (minimum / Math.sqrt(squared) - 1) * 0.48;
              a.x -= dx * force;
              a.y -= dy * force;
              b.x += dx * force;
              b.y += dy * force;
            }
          }
        }
      }
      for (const node of nodes) {
        node.x = Math.max(margin, Math.min(width - margin, node.x));
        node.y = Math.max(margin, Math.min(height - margin, node.y));
      }
    }
  }

  function chapterLabels(chapters, terms, index, nodes, clusters, spread) {
    const chapterById = new Map(chapters.map(chapter => [chapter.id, chapter]));
    const chapterByUnit = new Map();
    const evidence = nodes.map(() => new Set());
    for (const chapter of chapters) {
      for (const unit of chapter.units || []) {
        chapterByUnit.set(unit.id, chapter.id);
        for (const concept of unit.conceptIds || []) evidence[index.get(concept)]?.add(chapter.id);
      }
    }
    for (const term of terms) {
      if (!index.has(term?.id)) continue;
      const sources = evidence[index.get(term.id)];
      const direct = term.chapterId || term.chapter;
      if (chapterById.has(direct)) sources.add(direct);
      for (const unit of term.unitIds || []) {
        if (chapterByUnit.has(unit)) sources.add(chapterByUnit.get(unit));
      }
    }
    const groups = [];
    for (const cluster of clusters) {
      const votes = new Map();
      for (const i of cluster.members) {
        for (const chapter of evidence[i]) votes.set(chapter, (votes.get(chapter) || 0) + 1);
      }
      const [top, second] = [...votes].sort((a, b) => b[1] - a[1]);
      if (!top || top[1] < 2 || top[1] < 1.5 * (second?.[1] || 0)) continue;
      const title = chapterById.get(top[0])?.title;
      if (title) groups.push({id: cluster.id, title, x: width / 2 + cluster.x * spread.x, y: height / 2 + cluster.y * spread.y});
    }
    return groups;
  }

  function build(terms, {
    titleOf = term => term.displayTitle || term.title || term.id,
    chapters = [],
    resolveId,
  } = {}) {
    const random = randomSource();
    const {nodes, edges, adjacent, index} = collectGraph(terms, titleOf, resolveId);
    const communities = communitiesFor(adjacent, nodes, random);
    const clusters = buildClusters(communities, nodes, edges, random);
    positionClusters(clusters);
    const extent = clusters.reduce(({x, y}, cluster) => ({
      x: Math.max(x, Math.abs(cluster.x) + cluster.radius),
      y: Math.max(y, Math.abs(cluster.y) + cluster.radius / clusterAspect),
    }), {x: 1, y: 1});
    const spread = {
      x: Math.min(1.42, (width / 2 - 22) / extent.x),
      y: Math.min(1.19, (height / 2 - 20) / extent.y),
    };
    for (const cluster of clusters) positionMembers(cluster, clusters, nodes, adjacent, random, spread);
    positionIsolates(nodes, random);
    separateNodes(nodes);
    const groups = chapterLabels(chapters, terms, index, nodes, clusters, spread);
    return {width, height, nodes, edges, groups};
  }

  globalThis.AtlasLayout = {build};
})();
