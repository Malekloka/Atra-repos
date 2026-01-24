const mathUtils = {
  add(pos1, pos2){
    return {
      x: pos1.x + pos2.x,
      y: pos1.y + pos2.y
    }
  },
  subtract(pos1, pos2){
    return {
      x: pos1.x - pos2.x,
      y: pos1.y - pos2.y
    }
  },
  multiply(pos, scalar){
    return {
      x: pos.x * scalar,
      y: pos.y * scalar
    }
  }
}

export default mathUtils;