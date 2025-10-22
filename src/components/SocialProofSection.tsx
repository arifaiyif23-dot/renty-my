import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const testimonials = [
  {
    name: "Sarah Tan",
    location: "Kuala Lumpur",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    rating: 5,
    text: "Saved RM 1,200 renting a DSLR instead of buying! Perfect for my weekend shoots.",
    verified: true,
  },
  {
    name: "Ahmad Hafiz",
    location: "Johor Bahru",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmad",
    rating: 5,
    text: "Made RM 500/month from my camera that was just sitting in my cabinet. Amazing!",
    verified: true,
  },
  {
    name: "Priya Kumar",
    location: "Penang",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya",
    rating: 5,
    text: "Found the perfect car for my wedding. The owner was so helpful. Highly recommend!",
    verified: true,
  },
];

const stats = [
  { value: "50K+", label: "Successful Rentals" },
  { value: "RM 10M+", label: "Items Protected" },
  { value: "4.8★", label: "Average Rating" },
  { value: "24/7", label: "Support Available" },
];

export const SocialProofSection = () => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <div ref={ref} className="py-16 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Trusted by Thousands
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join our growing community of renters and owners building a more sustainable future
          </p>
        </motion.div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.2, duration: 0.5 }}
            >
              <Card className="glass-card p-6 h-full hover:shadow-xl transition-all duration-300">
                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-primary text-primary"
                    />
                  ))}
                </div>

                {/* Testimonial Text */}
                <p className="text-sm mb-4 leading-relaxed">
                  "{testimonial.text}"
                </p>

                {/* User Info */}
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={testimonial.avatar} />
                    <AvatarFallback>{testimonial.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">
                        {testimonial.name}
                      </p>
                      {testimonial.verified && (
                        <ShieldCheck className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.location}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Stats Row */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              className="text-center"
              whileHover={{ scale: 1.05 }}
            >
              <div className="glass-card p-6 rounded-lg">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust Badge */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8 }}
        >
          <Badge variant="outline" className="px-6 py-2 text-sm">
            <ShieldCheck className="w-4 h-4 mr-2" />
            All rentals protected with insurance
          </Badge>
        </motion.div>
      </div>
    </div>
  );
};
