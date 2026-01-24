const { Constraint } = Matter;

class StageConstraint {
  constructor(a, b, strength){
    this.items = [a, b];
    this.strength = strength;
    this.createMatter();
  }

  // const constraint = Matter.Constraint.create({
  //   bodyA: hub.matter,
  //   bodyB: item.body,
  //   stiffness: 0.002,
  //   damping: 0.02,
  //   length: Math.random() * 100 + 100
  // });
  
  createMatter(){
    this.matter = Constraint.create({
      bodyA: this.items[0].matter,
      bodyB: this.items[1].matter,
      stiffness: 0.002 + 0.004 * (this.strength * this.strength), // Increased stiffness to better pull nodes back
      damping: 0.03, // Slightly reduced damping to allow more dynamic motion
      length: (1.1 - this.strength * this.strength) * 150 + 80
    });
  }

  isConnectedTo(id){
    return this.items.some(item => item.id === id);
  }
}

export default StageConstraint;
