(() => {
  'use strict';

  const width = 1050;
  const height = 700;
  const turn = Math.PI * (3 - Math.sqrt(5));
  const topicTitles = new Map([
    ['세금의 구조', '세금'],
    ['부동산의 권리와 가치', '부동산'],
    ['금융회사 업무와 공시', '금융업과 공시'],
    ['대체투자, 신용파생, 해외투자', '대체투자와 해외투자'],
    ['기업가치, 재무분석, 현금흐름', '기업가치와 재무분석'],
    ['통계, 산업, 기술적 분석', '통계와 기술적 분석'],
    ['주식운용과 자산배분', '자산배분'],
    ['채권, 금리, 내재옵션', '채권과 금리'],
    ['선물, 환율, 헤지', '선물과 환헤지'],
    ['옵션의 권리, 의무와 전략', '옵션'],
    ['성과평가와 국제투자성과기준', '성과평가'],
    ['거시경제, 포트폴리오, 자본자산가격결정모형', '거시경제와 포트폴리오'],
  ]);

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
    const concepts = [];
    const index = new Map();
    for (const term of terms) {
      if (!term?.id || index.has(term.id)) continue;
      index.set(term.id, nodes.length);
      nodes.push({id: term.id, title: titleOf(term), x: 0, y: 0, degree: 0, group: -1});
      concepts.push(term);
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
        if (target === undefined || source === target) continue;
        const weight = link?.priority > 0 ? 1 + 4 / Math.sqrt(link.priority) : 2.45;
        const previous = adjacent[source].get(target);
        if (previous >= weight) continue;
        if (previous === undefined) edges.push(source < target ? [source, target] : [target, source]);
        adjacent[source].set(target, weight);
        adjacent[target].set(source, weight);
      }
    }
    nodes.forEach((node, i) => { node.degree = adjacent[i].size; });
    return {nodes, concepts, edges, adjacent};
  }

  function weightedDegree(links) {
    let total = 0;
    for (const weight of links.values()) total += weight;
    return total;
  }

  function topicMembership(concepts, adjacent, chapters) {
    const count = chapters.length;
    if (!count) return concepts.map(() => -1);
    const byId = new Map(chapters.map((chapter, i) => [chapter.id, i]));
    const byUnit = new Map();
    const byConcept = new Map();
    for (const [i, chapter] of chapters.entries()) {
      for (const unit of chapter.units || []) {
        byUnit.set(unit.id, i);
        for (const id of unit.conceptIds || []) {
          if (!byConcept.has(id)) byConcept.set(id, new Set());
          byConcept.get(id).add(i);
        }
      }
    }

    const evidence = new Float64Array(concepts.length * count);
    function mark(offset, term, strength) {
      const direct = byId.get(term.chapterId || term.chapter);
      if (direct !== undefined) evidence[offset + direct] = Math.max(evidence[offset + direct], strength);
      for (const unit of term.unitIds || []) {
        const i = byUnit.get(unit);
        if (i !== undefined) evidence[offset + i] = Math.max(evidence[offset + i], strength);
      }
      for (const i of byConcept.get(term.id) || []) {
        evidence[offset + i] = Math.max(evidence[offset + i], strength);
      }
    }
    for (const [i, term] of concepts.entries()) {
      mark(i * count, term, 1);
      for (const topic of term.layoutTopics || []) mark(i * count, topic, 0.76);
    }

    const degrees = adjacent.map(weightedDegree);
    let current = evidence.slice();
    let next = new Float64Array(evidence.length);
    for (let step = 0; step < 38; step++) {
      next.set(evidence);
      for (let i = 0; i < concepts.length; i++) {
        const offset = i * count;
        for (const [j, weight] of adjacent[i]) {
          const pull = weight / degrees[i] * 0.86;
          const neighbor = j * count;
          for (let k = 0; k < count; k++) next[offset + k] += current[neighbor + k] * pull;
        }
      }
      [current, next] = [next, current];
    }
    return concepts.map((_, i) => {
      let best = -1;
      let score = 0.001;
      for (let k = 0; k < count; k++) {
        if (current[i * count + k] <= score) continue;
        best = k;
        score = current[i * count + k];
      }
      return best;
    });
  }

  function partition(adjacent, degrees, total, random) {
    const membership = degrees.map((_, i) => i);
    const volumes = [...degrees];
    const order = degrees.map((_, i) => i).filter(i => degrees[i] > 0);
    for (let pass = 0; pass < 12; pass++) {
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
        const expected = 1.65 * degree / total;
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

  function communitiesFor(adjacent, random) {
    let degrees = adjacent.map(weightedDegree);
    let membership = degrees.map((_, i) => i);
    const total = degrees.reduce((sum, degree) => sum + degree, 0);
    for (let level = 0; total && level < 4; level++) {
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
    return membership;
  }

  function addConnection(a, b, weight) {
    if (a === b) return;
    const sum = (a.links.get(b) || 0) + weight;
    a.links.set(b, sum);
    b.links.set(a, sum);
  }

  function placeDisks(disks, steps, gap, aspect = 1) {
    if (disks.length < 2) return;
    const area = Math.sqrt(disks.reduce((sum, disk) => sum + disk.radius ** 2, 0));
    const placed = [...disks].sort((a, b) => b.radius - a.radius);
    for (const [i, disk] of placed.entries()) {
      const distance = area * Math.sqrt(i / placed.length);
      disk.x = Math.cos(i * turn) * distance;
      disk.y = Math.sin(i * turn) * distance / aspect;
    }
    const masses = disks.map(disk => Math.sqrt(disk.radius));
    for (let step = 0; step < steps; step++) {
      for (let i = 0; i < disks.length; i++) {
        const a = disks[i];
        a.x *= 0.985;
        a.y *= 0.985;
        for (let j = i + 1; j < disks.length; j++) {
          const b = disks[j];
          const dx = b.x - a.x || 0.0001;
          const dy = (b.y - a.y) * aspect;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const clearance = a.radius + b.radius + (a.satellite || b.satellite ? gap * 0.42 : gap);
          const overlap = clearance - distance;
          const attraction = 0.007 * Math.log1p((a.links.get(b) || 0) / 4);
          const force = overlap > 0 ? -0.34 * overlap / distance : -overlap * attraction / distance;
          const share = masses[j] / (masses[i] + masses[j]);
          a.x += dx * force * share;
          a.y += dy * force * share / aspect;
          b.x -= dx * force * (1 - share);
          b.y -= dy * force * (1 - share) / aspect;
        }
      }
    }
  }

  function seedLayout(nodes, edges, adjacent, topics, random, chapterCount) {
    const local = adjacent.map((links, i) => new Map([...links].filter(([j]) => topics[i] === topics[j])));
    const membership = communitiesFor(local, random);
    const clouds = new Map();
    const pockets = new Map();
    const homes = nodes.map((node, i) => {
      const topic = topics[i];
      if (topic < 0 && !node.degree) return null;
      node.group = chapterCount ? topic : membership[i];
      const satellite = chapterCount > 0 && topic < 0;
      const group = satellite ? chapterCount + membership[i] : node.group;
      if (!clouds.has(group)) {
        clouds.set(group, {id: node.group, satellite, x: 0, y: 0, radius: 0, members: [], pockets: [], links: new Map()});
      }
      const cloud = clouds.get(group);
      cloud.members.push(i);
      const key = membership[i];
      if (!pockets.has(key)) {
        const pocket = {cloud, members: [], links: new Map(), x: 0, y: 0, radius: 0};
        pockets.set(key, pocket);
        cloud.pockets.push(pocket);
      }
      const pocket = pockets.get(key);
      pocket.members.push(i);
      return pocket;
    });

    for (const [a, b] of edges) {
      const source = homes[a];
      const target = homes[b];
      const weight = adjacent[a].get(b);
      if (source.cloud === target.cloud) addConnection(source, target, weight);
      else addConnection(source.cloud, target.cloud, weight);
    }
    for (const cloud of clouds.values()) {
      for (const pocket of cloud.pockets) pocket.radius = 8.8 * Math.sqrt(pocket.members.length) + 4;
      placeDisks(cloud.pockets, 84, 19, 1.15);
      const reach = Math.max(...cloud.pockets.map(pocket => Math.hypot(pocket.x, pocket.y * 1.15) + pocket.radius));
      cloud.radius = Math.max(reach * 0.86, 10.6 * Math.sqrt(cloud.members.length)) + (cloud.satellite ? 2 : 12);
    }
    placeDisks([...clouds.values()], 118, 31, 1.56);

    for (const pocket of pockets.values()) {
      const {cloud, members} = pocket;
      pocket.x += cloud.x;
      pocket.y += cloud.y;
      const ordered = [...members].sort((a, b) => nodes[b].degree - nodes[a].degree);
      const tilt = random() * Math.PI * 2;
      for (const [i, index] of ordered.entries()) {
        const distance = pocket.radius * Math.sqrt(i / ordered.length);
        nodes[index].x = pocket.x + distance * Math.cos(i * turn + tilt);
        nodes[index].y = pocket.y + distance * Math.sin(i * turn + tilt);
      }
    }
    return {clouds, homes};
  }

  function settle(nodes, edges, adjacent, homes) {
    const springs = edges.map(([a, b]) => {
      const samePocket = homes[a] === homes[b];
      const sameTopic = homes[a].cloud === homes[b].cloud;
      const hubs = Math.sqrt(nodes[a].degree + nodes[b].degree);
      const strength = adjacent[a].get(b) / (1 + 0.13 * hubs);
      return [a, b, sameTopic ? 8 + hubs * 0.45 : 52, strength * (samePocket ? 0.108 : sameTopic ? 0.107 : 0.016)];
    });
    const included = nodes.map((_, i) => i).filter(i => homes[i]);
    const vx = new Float64Array(nodes.length);
    const vy = new Float64Array(nodes.length);
    const radius = nodes.map(node => Math.min(7.5, 4.7 + Math.sqrt(node.degree) * 0.44));
    const cellSize = 35;
    for (let step = 0; step < 115; step++) {
      const cells = new Map();
      for (const i of included) {
        const node = nodes[i];
        const key = Math.floor(node.x / cellSize) + Math.floor(node.y / cellSize) * 4096;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(i);
        const anchor = homes[i];
        vx[i] = 0.56 * vx[i] + (anchor.x - node.x) * 0.017;
        vy[i] = 0.56 * vy[i] + (anchor.y - node.y) * 0.017;
      }
      for (const [i, j, rest, strength] of springs) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const pull = Math.max(-3, Math.min(8, (d - rest) * strength)) / d;
        vx[i] += dx * pull;
        vy[i] += dy * pull;
        vx[j] -= dx * pull;
        vy[j] -= dy * pull;
      }
      for (const i of included) {
        const a = nodes[i];
        const cellX = Math.floor(a.x / cellSize);
        const cellY = Math.floor(a.y / cellSize);
        for (let row = cellY - 1; row <= cellY + 1; row++) {
          for (let column = cellX - 1; column <= cellX + 1; column++) {
            const nearby = cells.get(row * 4096 + column);
            if (!nearby) continue;
            for (const j of nearby) {
              if (j <= i) continue;
              const dx = nodes[j].x - a.x || 0.0001;
              const dy = nodes[j].y - a.y;
              const square = dx * dx + dy * dy;
              if (square >= cellSize * cellSize) continue;
              const distance = Math.sqrt(square);
              const minimum = radius[i] + radius[j];
              const linked = adjacent[i].has(j);
              const push = (0.84 * Math.max(0, minimum - distance)
                + (linked ? 0.01 : 0.098) * (cellSize - distance)) / distance;
              vx[i] -= dx * push;
              vy[i] -= dy * push;
              vx[j] += dx * push;
              vy[j] += dy * push;
            }
          }
        }
      }
      const cooling = Math.max(0.24, 1 - step / 119);
      for (const i of included) {
        nodes[i].x += Math.max(-12, Math.min(12, vx[i])) * cooling;
        nodes[i].y += Math.max(-12, Math.min(12, vy[i])) * cooling;
      }
    }
  }

  function fitMap(nodes, homes, clouds, chapters) {
    const connected = nodes.filter((_, i) => homes[i]);
    const isolates = nodes.filter((_, i) => !homes[i]);
    const bounds = points => points.reduce(({left, right, top, bottom}, {x, y}) => ({
      left: Math.min(left, x), right: Math.max(right, x), top: Math.min(top, y), bottom: Math.max(bottom, y),
    }), {left: 0, right: 0, top: 0, bottom: 0});
    if (isolates.length) {
      const main = bounds(connected);
      const radius = 12 * Math.sqrt(isolates.length - 1);
      const midX = (main.left + main.right) / 2;
      const midY = (main.top + main.bottom) / 2;
      const options = connected.length ? [
        [main.left, main.top], [main.right, main.top], [main.left, main.bottom], [main.right, main.bottom],
        [midX, main.top - radius - 22], [midX, main.bottom + radius + 22],
        [main.left - radius - 22, midY], [main.right + radius + 22, midY],
      ] : [[0, 0]];
      const fits = ([x, y]) => connected.every(node => Math.hypot(node.x - x, node.y - y) >= radius + 18);
      const cost = ([x, y]) => Math.max(
        (Math.max(main.right, x + radius) - Math.min(main.left, x - radius)) / width,
        (Math.max(main.bottom, y + radius) - Math.min(main.top, y - radius)) / height,
      );
      const [cx, cy] = options.filter(fits).sort((a, b) => cost(a) - cost(b))[0];
      for (const [i, node] of isolates.entries()) {
        const distance = 12 * Math.sqrt(i);
        node.x = cx + distance * Math.cos(i * turn);
        node.y = cy + distance * Math.sin(i * turn);
      }
    }

    const {left, right, top, bottom} = bounds(nodes);
    const zoom = Math.min(1, (width - 36) / Math.max(1, right - left), (height - 36) / Math.max(1, bottom - top));
    const x = value => width / 2 + (value - (left + right) / 2) * zoom;
    const y = value => height / 2 + (value - (top + bottom) / 2) * zoom;
    const groups = [];
    for (const {id, members} of clouds.values()) {
      const chapterTitle = chapters[id]?.title;
      if (!chapterTitle || members.length < 3) continue;
      const title = topicTitles.get(chapterTitle) || chapterTitle;
      const cx = members.reduce((sum, i) => sum + nodes[i].x, 0) / members.length;
      const cy = members.reduce((sum, i) => sum + nodes[i].y, 0) / members.length;
      groups.push({id, title, x: x(cx), y: y(cy)});
    }
    for (const node of nodes) {
      node.x = x(node.x);
      node.y = y(node.y);
    }
    return groups.sort((a, b) => a.id - b.id);
  }

  function build(terms, {
    titleOf = term => term.displayTitle || term.title || term.id,
    chapters = [],
    resolveId,
  } = {}) {
    const {nodes, concepts, edges, adjacent} = collectGraph(terms, titleOf, resolveId);
    const topics = topicMembership(concepts, adjacent, chapters);
    const {clouds, homes} = seedLayout(nodes, edges, adjacent, topics, randomSource(), chapters.length);
    settle(nodes, edges, adjacent, homes);
    const groups = fitMap(nodes, homes, clouds, chapters);
    return {width, height, nodes, edges, groups};
  }

  globalThis.AtlasLayout = {build};
})();
