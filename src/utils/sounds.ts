/**
 * Sound notification utilities
 * Plays audio feedback for important events
 */

class SoundPlayer {
  private audioContext: AudioContext | null = null;

  private getAudioContext() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    return this.audioContext;
  }

  /**
   * Play notification sound
   * A pleasant two-tone notification sound
   */
  playNotification() {
    try {
      const context = this.getAudioContext();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      // First tone (higher pitch)
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);
      
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.15);

      // Second tone (lower pitch)
      setTimeout(() => {
        const oscillator2 = context.createOscillator();
        const gainNode2 = context.createGain();

        oscillator2.connect(gainNode2);
        gainNode2.connect(context.destination);

        oscillator2.frequency.value = 600;
        oscillator2.type = 'sine';
        
        gainNode2.gain.setValueAtTime(0.3, context.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
        
        oscillator2.start(context.currentTime);
        oscillator2.stop(context.currentTime + 0.2);
      }, 100);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  /**
   * Play order/rental sound
   * A more prominent three-tone sound for important events
   */
  playOrder() {
    try {
      const context = this.getAudioContext();
      
      // Three ascending tones
      const frequencies = [500, 650, 800];
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          const oscillator = context.createOscillator();
          const gainNode = context.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(context.destination);

          oscillator.frequency.value = freq;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.25, context.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
          
          oscillator.start(context.currentTime);
          oscillator.stop(context.currentTime + 0.2);
        }, index * 120);
      });
    } catch (error) {
      console.error('Error playing order sound:', error);
    }
  }
}

export const soundPlayer = new SoundPlayer();
